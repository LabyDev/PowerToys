use crate::models::{AppStateData, FileEntry, SavedPath};
use std::fs;
use std::sync::Mutex;
use tauri::State;
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
    let mut next_id = data.files.len() as u64 + 1;

    // Clear existing files before repopulating
    data.files.clear();

    // Clone the paths so we don't immutably borrow while mutating
    let paths = data.paths.clone();

    for saved_path in &paths {
        if let Some(folder_path) = saved_path.path.as_path() {
            if folder_path.is_dir() {
                if let Ok(entries) = fs::read_dir(folder_path) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        if path.is_file() {
                            let name = path
                                .file_name()
                                .map(|s| s.to_string_lossy().to_string())
                                .unwrap_or_else(|| "unknown".to_string());

                            data.files.push(FileEntry {
                                id: next_id,
                                name,
                                path: FilePath::Path(path),
                            });

                            next_id += 1;
                        }
                    }
                }
            }
        }
    }

    data.files.clone()
}
