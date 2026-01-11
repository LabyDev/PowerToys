use crate::models::{FileSorterState, SortOperation, SortStats, SorterFileEntry};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use ignore::WalkBuilder;

pub struct UndoStack(pub Mutex<Vec<Vec<(String, String)>>>);

/* ===============================
   Commands: state & directory
================================ */

#[tauri::command]
pub fn get_sorter_state(state: State<'_, Mutex<FileSorterState>>) -> FileSorterState {
    state.lock().unwrap().clone()
}

#[tauri::command]
pub fn select_sort_directory(
    app: AppHandle,
    state: State<'_, Mutex<FileSorterState>>,
) -> Option<String> {
    let folder = app.dialog().file().blocking_pick_folder()?;
    let path_str = folder.to_string();

    let mut data = state.lock().unwrap();
    data.current_path = Some(path_str.clone());

    Some(path_str)
}

/* ===============================
   Crawl directory for full tree
================================ */

#[tauri::command]
pub fn crawl_sort_directory(path: String) -> Result<Vec<SorterFileEntry>, String> {
    let mut entries = Vec::new();

    let walker = WalkBuilder::new(&path)
        .hidden(false)
        .filter_entry(|_| true)
        .build();

    for entry in walker {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();

        if p == Path::new(&path) {
            continue;
        }

        // Always set is_dir correctly
        let is_dir = p.is_dir();

        entries.push(SorterFileEntry {
            path: p.to_string_lossy().to_string(),
            name: p
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            is_dir,
        });
    }

    Ok(entries)
}

/* ===============================
   Helpers
================================ */

fn normalize_file_stem(name: &str) -> String {
    Path::new(name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase()
}

fn calculate_similarity(s1: &str, s2: &str) -> f64 {
    if s1 == s2 {
        return 1.0;
    }

    let pairs1: Vec<String> = s1
        .chars()
        .collect::<Vec<_>>()
        .windows(2)
        .map(|w| format!("{}{}", w[0], w[1]))
        .collect();
    let pairs2: Vec<String> = s2
        .chars()
        .collect::<Vec<_>>()
        .windows(2)
        .map(|w| format!("{}{}", w[0], w[1]))
        .collect();

    if pairs1.is_empty() || pairs2.is_empty() {
        return 0.0;
    }

    let mut intersection = 0;
    let mut used = vec![false; pairs2.len()];

    for p1 in &pairs1 {
        for (i, p2) in pairs2.iter().enumerate() {
            if !used[i] && p1 == p2 {
                intersection += 1;
                used[i] = true;
                break;
            }
        }
    }

    (2.0 * intersection as f64) / (pairs1.len() + pairs2.len()) as f64
}

fn best_matching_folder(filename: &str, folders: &[PathBuf], threshold: f64) -> Option<PathBuf> {
    let file_norm = normalize_file_stem(filename);
    let mut best_sim = 0.0;
    let mut best_folder: Option<PathBuf> = None;

    for folder in folders {
        if let Some(folder_name) = folder.file_name().and_then(|n| n.to_str()) {
            let folder_norm = folder_name.to_lowercase();

            let similarity = calculate_similarity(&file_norm, &folder_norm);

            if similarity >= threshold && similarity > best_sim {
                best_sim = similarity;
                best_folder = Some(folder.clone());
            }
        }
    }
    best_folder
}

/* ===============================
   Build sort plan
================================ */

fn build_sort_plan(
    root: &str,
    files: &[SorterFileEntry],
    similarity_threshold: u8,
) -> Vec<SortOperation> {
    let root_path = Path::new(root);

    // 1. Load existing folders
    let mut folders: Vec<PathBuf> = std::fs::read_dir(root_path)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.is_dir())
                .collect()
        })
        .unwrap_or_default();

    let threshold = similarity_threshold as f64 / 100.0;
    let mut plan = Vec::new();

    for file in files.iter().filter(|f| !f.is_dir) {
        if Path::new(&file.path).parent() != Some(root_path) {
            continue;
        }

        let filename = Path::new(&file.path).file_name().unwrap().to_string_lossy();

        // 2. Try to find a match in existing OR newly planned folders
        let destination_folder =
            if let Some(folder) = best_matching_folder(&filename, &folders, threshold) {
                folder
            } else {
                let new_folder = root_path.join(normalize_file_stem(&filename));
                // Push so the next file (e.g., ATEST2) can match against this new folder
                if !folders.contains(&new_folder) {
                    folders.push(new_folder.clone());
                }
                new_folder
            };

        plan.push(SortOperation {
            file_name: filename.to_string(),
            source_path: file.path.clone(),
            destination_folder: destination_folder.to_string_lossy().to_string(),
            reason: "nucleo similarity".into(),
        });
    }

    plan
}

/* ===============================
   Execute plan + undo
================================ */

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

/* ===============================
   Commands: preview / sort / undo
================================ */

#[tauri::command]
pub fn get_sort_preview(
    state: State<'_, Mutex<FileSorterState>>,
) -> Result<FileSorterState, String> {
    let mut data = state.lock().unwrap().clone();
    let root = data.current_path.as_ref().ok_or("No folder selected")?;

    // Crawl full tree
    data.files = crawl_sort_directory(root.clone())?;

    // Build plan separately
    let plan = build_sort_plan(root, &data.files, data.similarity_threshold);

    data.preview = plan.clone();

    data.stats = SortStats {
        files_to_move: plan.len(),
        folders_to_create: plan
            .iter()
            .map(|op| op.destination_folder.clone())
            .collect::<HashSet<_>>()
            .len(),
    };

    Ok(data)
}

#[tauri::command]
pub fn sort_files(
    state: State<'_, Mutex<FileSorterState>>,
    undo_stack: State<'_, UndoStack>,
) -> Result<(), String> {
    let data = state.lock().unwrap();
    let root = data.current_path.as_ref().ok_or("No folder selected")?;

    let plan = build_sort_plan(root, &data.files, data.similarity_threshold);
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
