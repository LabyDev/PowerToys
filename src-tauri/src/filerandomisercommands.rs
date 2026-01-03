use crate::models::{
    AppStateData, FileEntry, FilterMatchType, FilterRule, HistoryEntry, SavedPath,
};
use crate::models::{FilterAction, RandomiserPreset};
use chrono::Utc;
use ignore::WalkBuilder;
use rand::distr::weighted::WeightedIndex;
use rand::prelude::*;
use rayon::prelude::*;
use std::sync::atomic::{AtomicU64, Ordering};
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
    // Try picking a folder; return None if user cancels
    let folder = match app.dialog().file().blocking_pick_folder() {
        Some(f) => f,
        None => return None, // user cancelled
    };

    let mut data = app_data.lock().unwrap();

    let name = folder
        .as_path()
        .iter()
        .last()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let new_path = SavedPath {
        id: data.paths.len() as u64 + 1,
        name: name,
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
    let filter_rules = data.filter_rules.clone();
    let next_id = AtomicU64::new(1);

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

    fn should_exclude(path: &std::path::Path, rules: &[FilterRule]) -> bool {
        let s = path.to_string_lossy();
        rules
            .iter()
            .any(|r| matches_rule(&s, r) && matches!(r.action, FilterAction::Exclude))
    }

    fn is_system_file(path: &std::path::Path) -> bool {
        if let Some(name) = path.file_name() {
            let name = name.to_string_lossy();
            if name.starts_with('.') {
                return true;
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if let Ok(meta) = path.metadata() {
                    if meta.file_attributes() & 0x2 != 0 {
                        return true;
                    }
                }
            }
        }
        false
    }

    // Fast non-cryptographic hash for bookmarks
    fn fast_file_id(path: &std::path::Path) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        if let Ok(meta) = path.metadata() {
            let modified = meta
                .modified()
                .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let size = meta.len();

            // Include file name + extension in hash
            let mut hasher = DefaultHasher::new();
            path.file_name().hash(&mut hasher); // includes extension
            size.hash(&mut hasher);
            modified.hash(&mut hasher);

            return hasher.finish();
        }
        0
    }

    // Collect all files
    let mut all_files: Vec<std::path::PathBuf> = Vec::new();
    for saved_path in &paths {
        if let Some(p) = saved_path.path.as_path() {
            if p.is_dir() {
                let walker = WalkBuilder::new(p)
                    .hidden(false)
                    .filter_entry(|e| !is_system_file(e.path()))
                    .build();
                all_files.extend(
                    walker
                        .filter_map(|r| r.ok())
                        .filter(|e| e.path().is_file())
                        .map(|e| e.path().to_path_buf()),
                );
            }
        }
    }

    // Parallel hashing & FileEntry construction
    let file_entries: Vec<FileEntry> = all_files
        .into_par_iter()
        .map(|path| {
            let id = next_id.fetch_add(1, Ordering::SeqCst);
            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or("unknown".to_string());
            let excluded = should_exclude(&path, &filter_rules);
            let hash = if excluded { 0 } else { fast_file_id(&path) };
            FileEntry {
                id,
                name,
                path: FilePath::Path(path),
                excluded,
                hash: Some(format!("{:x}", hash)), // convert u64 to hex string
            }
        })
        .collect();

    data.files = file_entries.clone();
    data.files.clone()
}

#[cfg(target_os = "windows")]
fn open_and_wait(path: &str) -> std::io::Result<()> {
    use std::process::Command;
    
    Command::new("cmd")
        .args(["/C", "start", "/WAIT", "", path])
        .status()?;

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
    randomness: Option<u8>, // 0–100
) -> Option<FileEntry> {
    let randomness = randomness.unwrap_or(50) as f64 / 100.0;
    let temperature = (1.0 - randomness).max(0.05); // avoid extreme spikes

    let mut data = app_data.lock().unwrap();

    let mut available_files: Vec<FileEntry> =
        data.files.iter().filter(|f| !f.excluded).cloned().collect();

    if available_files.is_empty() {
        return None;
    }

    let mut rng = rand::rng();

    // Remove order bias
    available_files.shuffle(&mut rng);

    // Build weights
    let weights: Vec<f64> = available_files
        .iter()
        .enumerate()
        .map(|(i, file)| {
            // base positional bias (soft)
            let pos = i as f64 / (available_files.len().saturating_sub(1).max(1)) as f64;
            let mut weight = (pos / temperature).exp();

            // avoid immediate repeat
            if Some(file.id) == data.last_picked_id {
                weight *= 0.1;
            }

            // penalize frequently picked files
            let picks = *data.pick_counts.get(&file.id).unwrap_or(&0) as f64;
            weight /= 1.0 + picks;

            weight.max(0.0001)
        })
        .collect();

    let dist = WeightedIndex::new(&weights).ok()?;
    let idx = dist.sample(&mut rng);
    let file = available_files[idx].clone();

    // update history
    data.last_picked_id = Some(file.id);
    *data.pick_counts.entry(file.id).or_insert(0) += 1;

    drop(data);

    let _ = open_file_tracked(
        app,
        match &file.path {
            FilePath::Path(p) => p.to_string_lossy().to_string(),
            FilePath::Url(u) => u.to_string(),
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
