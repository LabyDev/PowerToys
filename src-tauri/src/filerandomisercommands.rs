use crate::models::{
    AppStateData, FileEntry, FilterMatchType, FilterRule, HistoryEntry, SavedPath,
};
use crate::models::{FilterAction, RandomiserPreset};
use chrono::Utc;
use rand::distr::weighted::WeightedIndex;
use rand::prelude::*;
use std::fs;
use std::sync::Mutex;
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
    data.files.clear();
    let paths = data.paths.clone();
    let mut next_id = 1u64;

    let filter_rules = data.filter_rules.clone();

    fn matches_rule(path: &str, rule: &FilterRule) -> bool {
        let text = if rule.case_sensitive {
            path.to_string()
        } else {
            path.to_lowercase()
        };

        let pattern = if rule.case_sensitive {
            rule.pattern.clone()
        } else {
            rule.pattern.to_lowercase()
        };

        match rule.match_type {
            FilterMatchType::Contains => text.contains(&pattern),
            FilterMatchType::StartsWith => text.starts_with(&pattern),
            FilterMatchType::EndsWith => text.ends_with(&pattern),
            FilterMatchType::Regex => regex::Regex::new(&rule.pattern)
                .map(|r| r.is_match(path))
                .unwrap_or(false),
        }
    }

    fn should_exclude(path: &std::path::Path, filter_rules: &[FilterRule]) -> bool {
        let path_str = path.to_string_lossy();

        // Apply rules: last matching rule wins
        let mut result = false; // default: not excluded
        for rule in filter_rules {
            if matches_rule(&path_str, rule) {
                result = matches!(rule.action, FilterAction::Exclude);
            }
        }
        result
    }

    fn add_files_from_dir(
        dir: &std::path::Path,
        data: &mut AppStateData,
        next_id: &mut u64,
        filter_rules: &[FilterRule],
    ) {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();

                // Skip system/hidden files completely
                if is_system_file(&path) {
                    continue;
                }

                if path.is_file() {
                    let name = path
                        .file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_else(|| "unknown".to_string());

                    let excluded = should_exclude(&path, filter_rules);

                    data.files.push(FileEntry {
                        id: *next_id,
                        name,
                        path: FilePath::Path(path),
                        excluded,
                    });

                    *next_id += 1;
                } else if path.is_dir() {
                    add_files_from_dir(&path, data, next_id, filter_rules);
                }
            }
        }
    }

    // Helper function to detect system/hidden files
    fn is_system_file(path: &std::path::Path) -> bool {
        if let Some(file_name) = path.file_name() {
            let file_name = file_name.to_string_lossy();
            if file_name.starts_with('.') {
                return true;
            }

            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if let Ok(metadata) = path.metadata() {
                    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
                    if metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0 {
                        return true;
                    }
                }
            }
        }
        false
    }

    for saved_path in &paths {
        if let Some(folder_path) = saved_path.path.as_path() {
            if folder_path.is_dir() {
                add_files_from_dir(folder_path, &mut data, &mut next_id, &filter_rules);
            }
        }
    }

    data.files.clone()
}

#[cfg(target_os = "windows")]
fn open_and_wait(path: &str) -> std::io::Result<()> {
    use std::process::Command;

    // Use 'start' with '/WAIT' to block, and it usually focuses the window
    Command::new("cmd")
        .args(["/C", "start", "/WAIT", "", path])
        .status()?; // blocks until program exits

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
    // Update history immediately
    if let (Some(id), Some(name)) = (id, name) {
        let app_data = app.state::<Mutex<AppStateData>>();
        let mut state = app_data.lock().unwrap();

        state.history.push(HistoryEntry {
            id,
            name,
            path: FilePath::Path(path.clone().into()),
            opened_at: Utc::now(),
        });
    }

    // Spawn thread to open file and emit event when closed
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let _ = open_and_wait(&path);
        let _ = app_clone.emit("file-closed", ());
    });

    Ok(())
}

#[tauri::command]
pub fn pick_random_file(
    app: tauri::AppHandle,
    app_data: State<'_, Mutex<AppStateData>>,
    randomness: Option<u8>, // 0-100
) -> Option<FileEntry> {
    let randomness = randomness.unwrap_or(50) as f64 / 100.0;

    let data = app_data.lock().unwrap();
    if data.files.is_empty() {
        return None;
    }

    let available_files: Vec<_> = data.files.iter().filter(|f| !f.excluded).cloned().collect();
    if available_files.is_empty() {
        return None;
    }

    // Compute weights based on slider
    let weights: Vec<f64> = available_files
        .iter()
        .enumerate()
        .map(|(i, _)| {
            // exponential bias: low randomness favors first items
            let pos = i as f64 / (available_files.len() - 1) as f64; // 0 = first, 1 = last
            pos.powf(randomness)
        })
        .collect();

    let mut rng = rand::rng();
    let dist = WeightedIndex::new(&weights).unwrap();
    let idx = dist.sample(&mut rng);

    let file = available_files[idx].clone();
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

#[tauri::command]
pub fn update_app_state(app_data: State<'_, Mutex<AppStateData>>, new_data: AppStateData) {
    let mut data = app_data.lock().unwrap();
    *data = new_data;
}

#[tauri::command]
pub fn open_presets_folder(app: tauri::AppHandle) -> Result<(), String> {
    let presets_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("presets");

    std::fs::create_dir_all(&presets_dir).map_err(|e| e.to_string())?;

    app.opener()
        .open_path(presets_dir.to_string_lossy(), None::<String>)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_presets(app: tauri::AppHandle) -> Result<Vec<RandomiserPreset>, String> {
    let presets_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("presets");

    // Make sure the folder exists
    std::fs::create_dir_all(&presets_dir).map_err(|e| e.to_string())?;

    let mut presets = Vec::new();

    for entry in std::fs::read_dir(&presets_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // Only process .json files
        if path.extension().and_then(|s| s.to_str()) == Some("json") {
            let file_content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;

            // Try to deserialize; skip invalid files
            if let Ok(preset) = serde_json::from_str::<RandomiserPreset>(&file_content) {
                presets.push(preset);
            } else {
                eprintln!("Skipping invalid preset file: {:?}", path);
            }
        }
    }

    Ok(presets)
}

#[tauri::command]
pub fn save_preset(app: tauri::AppHandle, preset: RandomiserPreset) -> Result<(), String> {
    let presets_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("presets");

    // Ensure the presets folder exists
    std::fs::create_dir_all(&presets_dir).map_err(|e| e.to_string())?;

    // Sanitize name for file system (basic)
    let safe_name = preset
        .name
        .replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");

    let file_path = presets_dir.join(format!("{}.json", safe_name));
    let json_data = serde_json::to_string_pretty(&preset).map_err(|e| e.to_string())?;

    std::fs::write(file_path, json_data).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn open_path(app: tauri::AppHandle, path: tauri_plugin_dialog::FilePath) -> Result<(), String> {
    let folder_path = match path {
        tauri_plugin_dialog::FilePath::Path(p) => p,
        tauri_plugin_dialog::FilePath::Url(u) => {
            return Err(format!("Cannot open URL: {}", u));
        }
    };

    app.opener()
        .open_path(folder_path.to_string_lossy(), None::<String>)
        .map_err(|e| e.to_string())?;

    Ok(())
}
