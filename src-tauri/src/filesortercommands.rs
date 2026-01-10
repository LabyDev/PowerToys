use crate::models::{FileSorterState, SortOperation, SortStats};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

pub struct UndoStack(pub Mutex<Vec<Vec<(String, String)>>>);

#[tauri::command]
pub fn get_sorter_state(state: State<'_, Mutex<FileSorterState>>) -> FileSorterState {
    state.lock().unwrap().clone()
}

#[tauri::command]
pub fn select_sort_directory(
    app: AppHandle,
    state: State<'_, Mutex<FileSorterState>>,
) -> Option<String> {
    let folder = match app.dialog().file().blocking_pick_folder() {
        Some(f) => f,
        None => return None,
    };

    let path_str = folder.to_string();
    let mut data = state.lock().unwrap();
    data.current_path = Some(path_str.clone());

    Some(path_str)
}

#[tauri::command]
pub fn get_sort_preview(
    state: State<'_, Mutex<FileSorterState>>,
) -> Result<FileSorterState, String> {
    let mut data = state.lock().unwrap();
    
    // 1. Logic: Use data.filter_rules and data.similarity_threshold
    // to generate the Vec<SortOperation>
    let preview: Vec<SortOperation> = Vec::new(); // Implementation here

    // 2. Update state
    data.preview = preview.clone();
    data.stats = SortStats {
        files_to_move: preview.len(),
        folders_to_create: 0, // Calculate unique destination folders
    };

    Ok(data.clone())
}

#[tauri::command]
pub fn sort_files(
    state: State<'_, Mutex<FileSorterState>>,
    undo_stack: State<'_, UndoStack>,
) -> Result<(), String> {
    let data = state.lock().unwrap();
    let mut moves = Vec::new();

    for op in &data.preview {
        // Create folder
        std::fs::create_dir_all(&op.destination_folder).map_err(|e| e.to_string())?;

        // Build destination path
        let dest_path = std::path::Path::new(&op.destination_folder).join(&op.file_name);
        let dest_str = dest_path.to_string_lossy().to_string();

        // Perform move
        std::fs::rename(&op.source_path, &dest_path).map_err(|e| e.to_string())?;

        // Track for undo
        moves.push((op.source_path.clone(), dest_str));
    }

    undo_stack.0.lock().unwrap().push(moves);
    Ok(())
}

#[tauri::command]
pub fn restore_last_sort(undo_stack: State<'_, UndoStack>) -> Result<(), String> {
    let mut stack = undo_stack.0.lock().unwrap();
    if let Some(last_moves) = stack.pop() {
        for (original, current) in last_moves {
            let _ = std::fs::rename(current, original);
        }
    }
    Ok(())
}
