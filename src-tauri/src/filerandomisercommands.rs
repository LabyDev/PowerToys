use crate::models::{AppStateData, FileEntry, HistoryEntry, SavedPath};
use chrono::Utc;
use std::fs;
use std::sync::Mutex;
use tauri::Manager;
use tauri::State;
use tauri::{Emitter};
use tauri_plugin_dialog::{DialogExt, FilePath};

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

#[cfg(target_os = "windows")]
fn open_and_wait(path: &str) -> std::io::Result<()> {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::PCWSTR,
        Win32::UI::{
            Shell::{SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW},
            WindowsAndMessaging::SW_SHOWNORMAL,
        },
    };

    let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
    let wide_path: Vec<u16> = OsStr::new(path).encode_wide().chain(once(0)).collect();

    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_NOCLOSEPROCESS;
    info.lpFile = PCWSTR(wide_path.as_ptr());
    info.nShow = SW_SHOWNORMAL.0 as i32;

    unsafe {
        use windows::Win32::{
            Foundation::CloseHandle,
            System::Threading::{WaitForSingleObject, INFINITE},
            UI::Shell::ShellExecuteExW,
        };

        ShellExecuteExW(&mut info)?;
        WaitForSingleObject(info.hProcess, INFINITE);
        CloseHandle(info.hProcess)?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn open_and_wait(path: &str) -> std::io::Result<()> {
    std::process::Command::new("open")
        .arg("-W")
        .arg(path)
        .status()
        .map(|_| ())
}

#[cfg(target_os = "linux")]
fn open_and_wait(path: &str) -> std::io::Result<()> {
    std::process::Command::new("gio")
        .args(["open", "--wait", path])
        .status()
        .map(|_| ())
}

pub fn open_file_tracked(
    app: tauri::AppHandle,
    path: String,
    id: Option<u64>,
    name: Option<String>,
) -> Result<(), String> {
    let app_clone = app.clone();

    std::thread::spawn(move || {
        let _ = open_and_wait(&path);

        if let (Some(id), Some(name)) = (id, name) {
            let app_data = app_clone.state::<Mutex<AppStateData>>();
            let mut state = app_data.lock().unwrap();

            state.history.push(HistoryEntry {
                id,
                name,
                path: FilePath::Path(path.into()),
                opened_at: Utc::now(),
            });
        }

        let _ = app_clone.emit("file-closed", ());
    });

    Ok(())
}

#[tauri::command]
pub fn pick_random_file(
    app: tauri::AppHandle,
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
        match &file.path {
            FilePath::Path(p) => p.to_string_lossy().to_string(),
            FilePath::Url(u) => u.clone().to_string(),
        },
        Some(file.id),
        Some(file.name.clone()),
    );

    Some(file)
}

#[tauri::command]
pub fn open_file_by_id(
    app: tauri::AppHandle,
    app_data: State<'_, Mutex<AppStateData>>,
    id: u64,
) -> Option<FileEntry> {
    let data = app_data.lock().unwrap();
    let file = data.files.iter().find(|f| f.id == id)?.clone();
    drop(data);

    let _ = open_file_tracked(
        app.clone(),
        match &file.path {
            FilePath::Path(p) => p.to_string_lossy().to_string(),
            FilePath::Url(u) => u.clone().to_string(),
        },
        Some(file.id),
        Some(file.name.clone()),
    );

    Some(file)
}
