use crate::models::{FileSorterState, SortOperation, SortStats, SorterFileEntry};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use ignore::WalkBuilder;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_dialog::DialogExt;

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

    emit_log(&app, &format!("Directory selected: {}", path_str));

    Some(path_str)
}

/* ===============================
   Crawl directory
================================ */

#[tauri::command]
pub fn crawl_sort_directory(path: String, app: AppHandle) -> Result<Vec<SorterFileEntry>, String> {
    emit_log(&app, &format!("Crawling directory: {}", path));

    let mut entries = Vec::new();
    let walker = WalkBuilder::new(&path).hidden(false).build();

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

    emit_log(&app, &format!("Found {} entries", entries.len()));
    Ok(entries)
}

/* ===============================
   Logic Helpers
================================ */

fn normalize_name(name: &str) -> String {
    Path::new(name)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(name)
        .to_lowercase()
        .trim()
        .to_string()
}

/// Dice Coefficient: (2 * intersection) / (total length)
fn calculate_similarity(s1: &str, s2: &str) -> f64 {
    if s1 == s2 {
        return 1.0;
    }
    let n = s1.len();
    let m = s2.len();
    if n == 0 || m == 0 {
        return 0.0;
    }

    let mut intersection = 0;
    let mut s2_chars: Vec<char> = s2.chars().collect();

    for c in s1.chars() {
        if let Some(pos) = s2_chars.iter().position(|&x| x == c) {
            intersection += 1;
            s2_chars.remove(pos);
        }
    }

    (2.0 * intersection as f64) / (n + m) as f64
}

/* ===============================
   Build sort plan
================================ */

fn build_sort_plan(
    root: &str,
    files: &[SorterFileEntry],
    similarity_threshold: u8,
    app: Option<&AppHandle>,
) -> Vec<SortOperation> {
    let root_path = Path::new(root);
    let threshold = similarity_threshold as f64 / 100.0;

    let mut folders: Vec<(PathBuf, String)> = std::fs::read_dir(root_path)
        .map(|rd| {
            rd.filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| p.is_dir())
                .map(|p| {
                    let norm = p
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_lowercase();
                    (p, norm)
                })
                .collect()
        })
        .unwrap_or_default();

    let mut plan = Vec::new();

    for file in files.iter().filter(|f| !f.is_dir) {
        let file_path = Path::new(&file.path);
        if file_path.parent() != Some(root_path) {
            continue;
        }

        let file_norm = normalize_name(&file.name);
        let mut best_sim = 0.0;
        let mut best_folder = None;
        let mut best_folder_len = 0;

        for (path, norm) in &folders {
            let sim = calculate_similarity(&file_norm, norm);
            if sim >= threshold
                && (sim > best_sim
                    || ((sim - best_sim).abs() < f64::EPSILON && norm.len() > best_folder_len))
            {
                best_sim = sim;
                best_folder = Some(path.clone());
                best_folder_len = norm.len();
            }
        }

        let destination_folder = if let Some(folder) = best_folder {
            folder
        } else {
            let new_folder = root_path.join(&file_norm);
            folders.push((new_folder.clone(), file_norm.clone()));
            new_folder
        };

        let is_new_folder = !destination_folder.exists();

        if let Some(app) = app {
            emit_log(
                app,
                &format!(
                    "Plan: {} -> {} (new folder: {}, sim: {:.0}%)",
                    file.name,
                    destination_folder.to_string_lossy(),
                    is_new_folder,
                    best_sim * 100.0
                ),
            );
        }

        plan.push(SortOperation {
            file_name: file.name.clone(),
            source_path: file.path.clone(),
            destination_folder: destination_folder.to_string_lossy().to_string(),
            reason: format!("Dice Match ({:.0}%)", best_sim * 100.0),
            is_new_folder,
        });
    }

    plan
}

/* ===============================
   Execute plan (with Collision Protection)
================================ */

fn execute_sort_plan(
    plan: &[SortOperation],
    app: Option<&AppHandle>,
) -> Result<Vec<(String, String)>, String> {
    let mut moves = Vec::new();

    for op in plan {
        std::fs::create_dir_all(&op.destination_folder).map_err(|e| e.to_string())?;

        let mut dest_path = PathBuf::from(&op.destination_folder).join(&op.file_name);

        if dest_path.exists() {
            let stem = dest_path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let ext = dest_path
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let mut count = 1;

            while dest_path.exists() {
                let new_name = if ext.is_empty() {
                    format!("{} ({})", stem, count)
                } else {
                    format!("{} ({}).{}", stem, count, ext)
                };
                dest_path = PathBuf::from(&op.destination_folder).join(new_name);
                count += 1;
            }
        }

        let dest_str = dest_path.to_string_lossy().to_string();
        std::fs::rename(&op.source_path, &dest_path).map_err(|e| e.to_string())?;

        if let Some(app) = app {
            emit_log(app, &format!("Moved {} -> {}", op.source_path, dest_str));
        }

        moves.push((op.source_path.clone(), dest_str));
    }

    Ok(moves)
}

/* ===============================
   Commands: UI Interfacing
================================ */

#[tauri::command]
pub fn get_sort_preview(
    state: State<'_, Mutex<FileSorterState>>,
    app: AppHandle,
) -> Result<FileSorterState, String> {
    let mut data = state.lock().unwrap();

    let root = match data.current_path.clone() {
        Some(p) => p,
        None => return Err("No folder selected".into()),
    };

    data.files = crawl_sort_directory(root.clone(), app.clone())?;
    let plan = build_sort_plan(&root, &data.files, data.similarity_threshold, Some(&app));

    data.preview = plan.clone();

    let folders_to_create = plan
        .iter()
        .filter(|op| op.is_new_folder)
        .map(|op| &op.destination_folder)
        .collect::<HashSet<_>>()
        .len();

    data.stats = SortStats {
        files_to_move: plan.len(),
        folders_to_create,
    };

    Ok(data.clone())
}

#[tauri::command]
pub fn sort_files(
    state: State<'_, Mutex<FileSorterState>>,
    undo_stack: State<'_, UndoStack>,
    app: AppHandle,
) -> Result<(), String> {
    let mut data = state.lock().unwrap();

    if data.preview.is_empty() {
        return Err("No sort plan available".into());
    }

    emit_log(&app, "Executing sort plan");

    let moves = execute_sort_plan(&data.preview, Some(&app))?;

    undo_stack.0.lock().unwrap().push(moves);
    data.has_restore_point = true;

    // Re-crawl after move to keep UI consistent
    if let Some(root) = &data.current_path {
        data.files = crawl_sort_directory(root.clone(), app.clone())?;
    }

    // Clear preview & stats after execution
    data.preview.clear();
    data.stats = SortStats {
        files_to_move: 0,
        folders_to_create: 0,
    };

    emit_log(&app, "Sorting complete");
    Ok(())
}

#[tauri::command]
pub fn restore_last_sort(
    state: State<'_, Mutex<FileSorterState>>,
    undo_stack: State<'_, UndoStack>,
    app: AppHandle,
) -> Result<(), String> {
    let mut stack = undo_stack.0.lock().unwrap();

    let Some(last_moves) = stack.pop() else {
        return Ok(());
    };

    emit_log(&app, "Restoring last sort");

    for (original, current) in last_moves {
        std::fs::rename(&current, &original).map_err(|e| format!("Restore failed: {}", e))?;
        emit_log(&app, &format!("Restored {} -> {}", current, original));
    }

    let mut data = state.lock().unwrap();
    data.has_restore_point = !stack.is_empty();

    // Refresh files after restore
    if let Some(root) = &data.current_path {
        data.files = crawl_sort_directory(root.clone(), app.clone())?;
    }

    Ok(())
}

#[tauri::command]
pub fn set_similarity_threshold(state: State<'_, Mutex<FileSorterState>>, threshold: u8) {
    let mut data = state.lock().unwrap();
    data.similarity_threshold = threshold;
}

fn emit_log(app: &AppHandle, message: &str) {
    let _ = app.emit("file_sorter_log", message.to_string());
}
