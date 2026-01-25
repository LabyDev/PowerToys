use crate::models::{
    AppStateData, Bookmark, FileEntry, FilterMatchType, FilterRule, HistoryEntry, SavedPath,
};
use crate::models::{FilterAction, RandomiserPreset};
use crate::setting_commands::get_app_settings;
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
use tauri_plugin_dialog::FilePath;
use tauri_plugin_opener::OpenerExt;

#[tauri::command]
pub fn get_app_state(state: State<'_, Mutex<AppStateData>>) -> AppStateData {
    state.lock().unwrap().clone()
}

#[tauri::command]
pub async fn add_path_via_dialog(
    app: tauri::AppHandle,
    app_data: State<'_, Mutex<AppStateData>>,
) -> Result<Option<SavedPath>, String> {
    use tauri_plugin_dialog::DialogExt;

    // Run blocking dialog off the main thread
    let folder =
        tauri::async_runtime::spawn_blocking(move || app.dialog().file().blocking_pick_folder())
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Dialog cancelled".to_string())?;

    let mut data = app_data.lock().unwrap();

    let name = folder
        .as_path()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let new_path = SavedPath {
        id: data.paths.len() as u64 + 1,
        name,
        path: folder,
    };

    data.paths.push(new_path.clone());
    Ok(Some(new_path))
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
pub fn crawl_paths(
    app_data: State<'_, Mutex<AppStateData>>,
    global_bookmarks: Vec<Bookmark>,
    local_bookmarks: Vec<Bookmark>,
) -> Vec<FileEntry> {
    let mut data = app_data.lock().unwrap();
    data.files.clear();

    let paths = data.paths.clone();
    let filter_rules = data.filter_rules.clone();
    let next_id = AtomicU64::new(1);

    fn matches_rule(
        path: &str,
        hash_val: u64,
        rule: &FilterRule,
        global: &[Bookmark],
        local: &[Bookmark],
    ) -> bool {
        let hash_str = format!("{:x}", hash_val);

        if let FilterMatchType::Bookmarks = rule.match_type {
            let pattern_lower = rule.pattern.trim().to_lowercase();
            let raw = pattern_lower.strip_prefix("@bookmarks").unwrap_or("");

            let mut scope: Option<&str> = None;
            let mut colors: Vec<String> = Vec::new();

            let parts: Vec<&str> = raw.split(':').filter(|p| !p.is_empty()).collect();

            for part in parts {
                match part {
                    "global" | "nonglobal" => scope = Some(part),
                    _ => {
                        colors = part
                            .split(',')
                            .map(|c| match c.trim() {
                                "gold" | "yellow" => "#ffd700",
                                "red" => "#ff6b6b",
                                "green" => "#6bcb77",
                                "blue" => "#4d96ff",
                                other => other,
                            })
                            .map(|c| c.to_string())
                            .collect();
                    }
                }
            }

            let matches_list = |list: &[Bookmark]| {
                list.iter().any(|bm| {
                    if bm.hash.to_lowercase() != hash_str {
                        return false;
                    }
                    if colors.is_empty() {
                        return true;
                    }
                    bm.color
                        .as_ref()
                        .map(|c| colors.iter().any(|t| t.eq_ignore_ascii_case(c)))
                        .unwrap_or(false)
                })
            };

            match scope {
                Some("global") => matches_list(global),
                Some("nonglobal") => matches_list(local),
                _ => matches_list(global) || matches_list(local),
            }
        } else {
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
                _ => false,
            }
        }
    }

    fn should_include(
        path: &std::path::Path,
        hash_val: u64,
        rules: &[FilterRule],
        global: &[Bookmark],
        local: &[Bookmark],
    ) -> bool {
        let s = path.to_string_lossy();
        rules.iter().any(|r| {
            matches_rule(&s, hash_val, r, global, local)
                && matches!(r.action, FilterAction::Include)
        })
    }

    fn should_exclude(
        path: &std::path::Path,
        hash_val: u64,
        rules: &[FilterRule],
        global: &[Bookmark],
        local: &[Bookmark],
    ) -> bool {
        let s = path.to_string_lossy();
        rules.iter().any(|r| {
            matches_rule(&s, hash_val, r, global, local)
                && matches!(r.action, FilterAction::Exclude)
        })
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

            let mut hasher = DefaultHasher::new();
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

            // Calculate hash first so we can use it for filter matching
            let hash_val = fast_file_id(&path);
            let included = should_include(
                &path,
                hash_val,
                &filter_rules,
                &global_bookmarks,
                &local_bookmarks,
            );

            let excluded = if included {
                false
            } else {
                should_exclude(
                    &path,
                    hash_val,
                    &filter_rules,
                    &global_bookmarks,
                    &local_bookmarks,
                )
            };

            FileEntry {
                id,
                name,
                path: FilePath::Path(path),
                excluded,
                hash: Some(format!("{:x}", hash_val)),
            }
        })
        .collect();

    data.files = file_entries.clone();
    data.files.clone()
}

#[cfg(target_os = "windows")]
fn open_and_wait(path: &str, show_cmd: bool) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    if show_cmd {
        // tracking → wait for process
        Command::new("cmd")
            .args(["/C", "start", "/WAIT", "", path])
            .status()?;
    } else {
        // no tracking → hide cmd, taskbar flash only
        Command::new("cmd")
            .args(["/C", "start", "", path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()?;
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn open_and_wait(path: &str, show_cmd: bool) -> std::io::Result<()> {
    if show_cmd {
        std::process::Command::new("open")
            .arg("-W")
            .arg(path)
            .status()
            .map(|_| ())
    } else {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map(|_| ())
    }
}

#[cfg(target_os = "linux")]
fn open_and_wait(path: &str, show_cmd: bool) -> std::io::Result<()> {
    if show_cmd {
        std::process::Command::new("gio")
            .args(["open", "--wait", path])
            .status()
            .map(|_| ())
    } else {
        std::process::Command::new("gio")
            .args(["open", path])
            .spawn()
            .map(|_| ())
    }
}

pub fn open_file_tracked(
    app: tauri::AppHandle,
    path: String,
    id: Option<u64>,
    name: Option<String>,
) -> Result<(), String> {
    let settings = get_app_settings(app.clone())?;
    let allow_tracking = settings.file_randomiser.allow_process_tracking;
    if let (Some(id), Some(name)) = (id, name) {
        let app_data_lock = app.state::<Mutex<AppStateData>>();
        let mut state = app_data_lock.lock().unwrap();
        state.history.push(HistoryEntry {
            id,
            name,
            path: FilePath::Path(path.clone().into()),
            opened_at: Utc::now(),
        });
    }

    // Spawn thread to open file
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let _ = open_and_wait(&path, allow_tracking);
        if allow_tracking {
            let _ = app_clone.emit("file-closed", ());
        }
    });

    Ok(())
}

#[tauri::command]
pub fn pick_random_file(
    app: tauri::AppHandle,
    app_data: State<'_, Mutex<AppStateData>>,
) -> Option<FileEntry> {
    let settings = get_app_settings(app.clone()).ok()?;
    let randomness_level = settings.file_randomiser.randomness_level;

    let r = (randomness_level as f64 / 100.0).clamp(0.0, 1.0);
    let mut rng = rand::rng();

    let mut data = app_data.lock().unwrap();

    let all: Vec<(usize, FileEntry)> = data
        .files
        .iter()
        .enumerate()
        .filter(|(_, f)| !f.excluded)
        .map(|(i, f)| (i, f.clone()))
        .collect();

    if all.is_empty() {
        return None;
    }

    let len = all.len();

    let last_index = data.last_picked_index.unwrap_or(0);

    // ---- DIRECTION BIAS (smooth) ----
    // r=0   -> always forward
    // r=1   -> fully bidirectional
    let direction = if rng.random::<f64>() < r {
        rng.random_range(0..len)
    } else {
        (last_index + 1) % len
    };

    // ---- JUMP DISTANCE CURVE ----
    // r=0   -> always distance 1
    // r=1   -> uniform distance
    let max_dist = len as f64;
    let dist = if r < 0.0001 {
        1.0
    } else {
        let u = rng.random::<f64>();
        (u.powf(1.0 / (1.0 + 4.0 * r)) * max_dist).max(1.0)
    };

    let target_index = (direction + dist as usize) % len;

    // ---- MEMORY WEIGHTING (smooth fade-out) ----
    let memory_strength = (1.0 - r).powf(2.0);

    let weights: Vec<f64> = all
        .iter()
        .map(|(_, file)| {
            let mut w = 1.0;

            let picks = *data.pick_counts.get(&file.id).unwrap_or(&0) as f64;
            w /= 1.0 + picks * 2.0 * memory_strength;

            w.max(0.000001)
        })
        .collect();

    let dist = WeightedIndex::new(&weights).ok()?;
    let weighted_choice = dist.sample(&mut rng);

    // Blend index choice with weighted memory
    let final_index =
        ((target_index as f64 * r) + (weighted_choice as f64 * (1.0 - r))) as usize % len;

    let (picked_index, file) = all[final_index].clone();

    // ---- UPDATE STATE ----
    data.last_picked_index = Some(picked_index);
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

    println!("r={:.2}, last={}, picked={}", r, last_index, picked_index);

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
