use crate::models::{FileSorterState, SortOperation, SortStats, SorterFileEntry};
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

use ignore::WalkBuilder;
use std::path::Path;

#[tauri::command]
pub fn crawl_sort_directory(path: String) -> Result<Vec<SorterFileEntry>, String> {
    let mut entries = Vec::new();

    let walker = WalkBuilder::new(&path)
        .hidden(false)
        .filter_entry(|_e| {
            // skip .git etc later if needed
            true
        })
        .build();

    for entry in walker {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();

        // skip root itself
        if p == Path::new(&path) {
            continue;
        }

        entries.push(SorterFileEntry {
            path: p.to_string_lossy().to_string(),
            name: p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            is_dir: p.is_dir(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn get_sort_preview(
    state: State<'_, Mutex<FileSorterState>>,
) -> Result<FileSorterState, String> {
    let mut data = state.lock().unwrap();

    let current_path = match &data.current_path {
        Some(p) => p.clone(),
        None => return Err("No folder selected".into()),
    };

    // Crawl the folder
    let entries = crawl_sort_directory(current_path.clone())?;

    // Apply filters (simple example, you can expand based on FilterRule)
    let filtered_files: Vec<_> = entries
        .into_iter()
        .filter(|e| !e.is_dir) // skip directories for sorting
        // .filter(|e| {
        //     data.filter_rules.iter().all(|rule| {
        //         // Example: match by file extension
        //         if let Some(ext) = rule.extension.clone() {
        //             e.name.ends_with(&ext)
        //         } else {
        //             true
        //         }
        //     })
        // })
        .collect();

    // Build SortOperations
    let preview: Vec<SortOperation> = filtered_files
        .into_iter()
        .map(|file| SortOperation {
            source_path: file.path.clone(),
            destination_folder: format!("{}/Sorted", current_path),
            file_name: file.name.clone(),
            reason: "matches filter".to_string(),
        })
        .collect();

    // Update stats
    let stats = SortStats {
        files_to_move: preview.len(),
        folders_to_create: preview
            .iter()
            .map(|op| op.destination_folder.clone())
            .collect::<std::collections::HashSet<_>>()
            .len(),
    };

    data.preview = preview;
    data.stats = stats;

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
