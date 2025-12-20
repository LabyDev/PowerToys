use crate::models::{AppStateData, SavedPath};
use std::sync::Mutex;
use tauri::State;
use tauri_plugin_dialog::DialogExt;

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
