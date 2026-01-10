use crate::models::{FileSorterState, SortOperation, SortStats, SorterFileEntry};
use std::path::Path;
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

#[tauri::command]
pub fn crawl_sort_directory(path: String) -> Result<Vec<SorterFileEntry>, String> {
    let mut entries = Vec::new();

    let walker = WalkBuilder::new(&path)
        .hidden(false)
        .filter_entry(|_e| true)
        .build();

    for entry in walker {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();

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

/// Core logic: compute destination folder for a file
fn compute_destination(root: &str, file: &SorterFileEntry) -> (String, String) {
    let relative = Path::new(&file.path)
        .strip_prefix(root)
        .unwrap_or(Path::new(""))
        .parent()
        .unwrap_or(Path::new(""))
        .to_string_lossy()
        .to_string();

    let destination_folder = if relative.is_empty() {
        format!("{}/Sorted", root)
    } else {
        format!("{}/Sorted/{}", root, relative)
    };

    (file.name.clone(), destination_folder)
}

/// Build sort plan (used for preview and actual sort)
fn build_sort_plan(root: &str, files: &[SorterFileEntry]) -> Vec<SortOperation> {
    files
        .iter()
        .filter(|f| !f.is_dir)
        .map(|f| {
            let (file_name, destination_folder) = compute_destination(root, f);
            SortOperation {
                file_name,
                source_path: f.path.clone(),
                destination_folder,
                reason: "planned".into(),
            }
        })
        .collect()
}

/// Execute a plan, moving files and tracking undo
fn execute_sort_plan(plan: &[SortOperation]) -> Result<Vec<(String, String)>, String> {
    let mut moves = Vec::new();

    for op in plan {
        std::fs::create_dir_all(&op.destination_folder).map_err(|e| e.to_string())?;
        let dest_path = Path::new(&op.destination_folder).join(&op.file_name);
        let dest_str = dest_path.to_string_lossy().to_string();

        std::fs::rename(&op.source_path, &dest_path).map_err(|e| e.to_string())?;

        moves.push((op.source_path.clone(), dest_str));
    }

    Ok(moves)
}

#[tauri::command]
pub fn get_sort_preview(
    state: State<'_, Mutex<FileSorterState>>,
) -> Result<FileSorterState, String> {
    let mut data = state.lock().unwrap().clone();
    let root = data.current_path.as_ref().ok_or("No folder selected")?;

    data.files = crawl_sort_directory(root.clone())?;

    let plan = build_sort_plan(root, &data.files);
    data.preview = plan.clone();

    data.stats = SortStats {
        files_to_move: plan.len(),
        folders_to_create: plan
            .iter()
            .map(|op| op.destination_folder.clone())
            .collect::<std::collections::HashSet<_>>()
            .len(),
    };

    Ok(data.clone())
}

#[tauri::command]
pub fn sort_files(
    state: State<'_, Mutex<FileSorterState>>,
    undo_stack: State<'_, UndoStack>,
) -> Result<(), String> {
    let data = state.lock().unwrap();
    let root = data.current_path.as_ref().ok_or("No folder selected")?;
    let plan = build_sort_plan(root, &data.files);

    let moves = execute_sort_plan(&plan)?;
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
