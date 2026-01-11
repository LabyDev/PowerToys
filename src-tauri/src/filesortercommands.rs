use crate::models::{FileSorterState, SortOperation, SortStats, SorterFileEntry};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use nucleo::pattern::{AtomKind, CaseMatching, Normalization, Pattern};
use nucleo::{Matcher, Utf32Str};
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

fn best_matching_folder(
    filename: &str,
    folders: &[PathBuf],
    threshold: f64,
    matcher: &mut Matcher,
) -> Option<PathBuf> {
    let file_norm = normalize_file_stem(filename);
    let pattern = Pattern::new(
        &file_norm,
        CaseMatching::Ignore,
        Normalization::Smart,
        AtomKind::Fuzzy,
    );

    let mut best_score = 0;
    let mut best_folder: Option<PathBuf> = None;
    let mut utf32_buf = Vec::new();

    for folder in folders {
        if let Some(folder_name) = folder.file_name().and_then(|n| n.to_str()) {
            let folder_norm = folder_name.to_lowercase();
            let haystack = Utf32Str::new(&folder_norm, &mut utf32_buf);

            if let Some(score) = pattern.score(haystack, matcher) {
                let normalized = score as f64 / (file_norm.len().max(1) as f64 * 100.0);

                if normalized >= threshold && score > best_score {
                    best_score = score;
                    best_folder = Some(folder.clone());
                }
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
    let mut matcher = Matcher::default();

    // Only top-level folders, subfolders are assumed sorted
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
        let file_path = Path::new(&file.path);
        let filename = file_path.file_name().unwrap().to_string_lossy();

        let destination_folder = if let Some(folder) =
            best_matching_folder(&filename, &folders, threshold, &mut matcher)
        {
            folder
        } else {
            let new_folder = root_path.join(normalize_file_stem(&filename));
            folders.push(new_folder.clone());
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
