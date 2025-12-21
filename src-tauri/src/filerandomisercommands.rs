use crate::models::{AppStateData, FileEntry, HistoryEntry, RuntimeState, SavedPath};
use chrono::Utc;
use std::process::Child;
use std::sync::Mutex;
use std::{fs, sync::atomic::Ordering};
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn get_app_state(state: State<'_, Mutex<AppStateData>>) -> AppStateData {
    state.lock().unwrap().clone()
}

#[tauri::command]
pub fn add_path_via_dialog(
    app: tauri::AppHandle,
    app_data: State<'_, Mutex<AppStateData>>,
) -> Option<SavedPath> {
    let folder = app.dialog().file().blocking_pick_folder().unwrap();

    let mut data = app_data.lock().unwrap();

    let new_path = SavedPath {
        id: data.paths.len() as u64 + 1,
        name: folder
            .as_path()
            .and_then(|p| p.file_name())
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string()),
        path: folder,
    };

    data.paths.push(new_path.clone());
    Some(new_path)
}

#[tauri::command]
pub fn remove_path(app_data: State<'_, Mutex<AppStateData>>, id: u64) -> bool {
    let mut data = app_data.lock().unwrap();

    // Retain only the paths whose id does NOT match the one we want to remove
    let original_len = data.paths.len();
    data.paths.retain(|p| p.id != id);

    // Return true if something was removed
    original_len != data.paths.len()
}

#[tauri::command]
pub fn crawl_paths(app_data: State<'_, Mutex<AppStateData>>) -> Vec<FileEntry> {
    let mut data = app_data.lock().unwrap();
    let mut next_id = 1u64;

    // Clear existing files before repopulating
    data.files.clear();

    // Clone the paths so we don't immutably borrow while mutating
    let paths = data.paths.clone();

    // Recursive helper function
    fn add_files_from_dir(dir: &std::path::Path, data: &mut AppStateData, next_id: &mut u64) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let name = path
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string());

                    data.files.push(FileEntry {
                        id: *next_id,
                        name,
                        path: FilePath::Path(path),
                    });
                    *next_id += 1;
                } else if path.is_dir() {
                    // Recursive call for subdirectory
                    add_files_from_dir(&path, data, next_id);
                }
            }
        }
    }

    for saved_path in &paths {
        if let Some(folder_path) = saved_path.path.as_path() {
            if folder_path.is_dir() {
                add_files_from_dir(folder_path, &mut data, &mut next_id);
            }
        }
    }

    data.files.clone()
}

pub fn open_file_tracked(
    app: tauri::AppHandle,
    runtime: State<'_, Mutex<RuntimeState>>,
    app_data: State<'_, Mutex<AppStateData>>,
    path: String,
    id: Option<u64>,
    name: Option<String>,
) -> Result<(), String> {
    // Spawn OS-specific command
    let child: Option<Child> = {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("cmd")
                .args(["/C", "start", "", &path])
                .spawn()
                .ok()
        }
        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open").arg(&path).spawn().ok()
        }
        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&path)
                .spawn()
                .ok()
        }
    };

    // Store child
    if let Some(c) = child {
        let mut runtime_lock = runtime.lock().map_err(|e| e.to_string())?;
        let mut current_child = runtime_lock
            .current_child
            .lock()
            .map_err(|e| e.to_string())?;
        current_child.replace(c);
    }

    // Update history
    if let (Some(id), Some(name)) = (id, name) {
        let state_handle = app_data;
        let mut app_state = state_handle.lock().map_err(|e| e.to_string())?;
        app_state.history.push(HistoryEntry {
            id,
            name,
            path: FilePath::Path(std::path::PathBuf::from(&path)),
            opened_at: Utc::now(),
        });
    }

    Ok(())
}

#[tauri::command]
pub fn pick_random_file(
    app: tauri::AppHandle,
    runtime: State<'_, Mutex<RuntimeState>>,
    app_data: State<'_, Mutex<AppStateData>>,
) -> Option<FileEntry> {
    let data = app_data.lock().unwrap();

    if data.files.is_empty() {
        return None;
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let index = (now % (data.files.len() as u128)) as usize;
    let file = data.files[index].clone();
    drop(data); // release lock before calling open_file_tracked

    let _ = open_file_tracked(
        app.clone(),
        runtime,
        app_data,
        match &file.path {
            FilePath::Path(p) => p.to_string_lossy().to_string(),
            FilePath::Url(u) => u.clone().to_string(),
            _ => return None,
        },
        Some(file.id),
        Some(file.name.clone()),
    );

    Some(file)
}

#[tauri::command]
pub fn open_file_by_id(
    app: tauri::AppHandle,
    runtime: State<'_, Mutex<RuntimeState>>,
    app_data: State<'_, Mutex<AppStateData>>,
    id: u64,
) -> Option<FileEntry> {
    let data = app_data.lock().unwrap();
    let file = data.files.iter().find(|f| f.id == id)?.clone();
    drop(data);

    let _ = open_file_tracked(
        app.clone(),
        runtime,
        app_data,
        match &file.path {
            FilePath::Path(p) => p.to_string_lossy().to_string(),
            FilePath::Url(u) => u.clone().to_string(),
            _ => return None,
        },
        Some(file.id),
        Some(file.name.clone()),
    );

    Some(file)
}

#[tauri::command]
pub fn start_tracking(app: tauri::AppHandle) {
    let runtime_mutex = app.state::<Mutex<RuntimeState>>();

    // Prevent multiple tracking threads
    if runtime_mutex
        .lock()
        .unwrap()
        .running
        .swap(true, Ordering::SeqCst)
    {
        return;
    }

    let app_clone = app.clone();

    std::thread::spawn(move || {
        let runtime = app_clone.state::<Mutex<RuntimeState>>();

        while runtime.lock().unwrap().running.load(Ordering::SeqCst) {
            std::thread::sleep(std::time::Duration::from_millis(500));

            // Lock the runtime and current_child
            let mut runtime_guard = runtime.lock().unwrap();
            let mut child_guard = runtime_guard.current_child.lock().unwrap();

            // Only check if there's a child
            if let Some(c) = child_guard.as_mut() {
                match c.try_wait() {
                    Ok(Some(_)) => {
                        // Process exited, clear it
                        *child_guard = None;
                        drop(child_guard);
                        drop(runtime_guard);

                        // Emit after releasing locks
                        let _ = app_clone.emit("file-closed", ());
                    }
                    Ok(None) => {
                        // Still running, do nothing
                    }
                    Err(e) => {
                        eprintln!("Error checking child: {}", e);
                        *child_guard = None;
                    }
                }
            }
        }
    });
}

#[tauri::command]
pub fn stop_tracking(runtime: State<'_, Mutex<RuntimeState>>) {
    let runtime_data = runtime.lock().unwrap();
    runtime_data.running.store(false, Ordering::SeqCst);
    runtime_data.current_child.lock().unwrap().take();
}
