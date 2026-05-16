use crate::models::{
    AppStateData, Bookmark, FileEntry, FileScore, FilterMatchType, FilterRule, HistoryEntry,
    SavedPath,
};
use crate::models::{FilterAction, RandomiserPreset};
use crate::models::common::hash_from_meta;
use crate::setting_commands::get_app_settings;
use std::collections::HashMap;
use chrono::Utc;
use ignore::WalkBuilder;
use rand::distr::weighted::WeightedIndex;
use rand::prelude::*;
use rayon::prelude::*;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
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
) -> Result<Vec<SavedPath>, String> {
    use tauri_plugin_dialog::DialogExt;

    // Pick multiple folders (blocking UI call on a blocking thread)
    let folders =
        tauri::async_runtime::spawn_blocking(move || app.dialog().file().blocking_pick_folders())
            .await
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Dialog cancelled".to_string())?;

    let mut data = app_data.lock().unwrap();
    let mut added = Vec::new();

    for folder in folders {
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
        added.push(new_path);
    }

    Ok(added)
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

    fn resolve_bookmark(
        hash: &str,
        global: &[Bookmark],
        local: &[Bookmark],
    ) -> Option<crate::models::BookmarkInfo> {
        // Local overrides global
        if let Some(bm) = local.iter().find(|b| b.hash.eq_ignore_ascii_case(hash)) {
            return Some(crate::models::BookmarkInfo {
                color: bm.color.clone(),
                is_global: false,
            });
        }

        if let Some(bm) = global.iter().find(|b| b.hash.eq_ignore_ascii_case(hash)) {
            return Some(crate::models::BookmarkInfo {
                color: bm.color.clone(),
                is_global: true,
            });
        }

        None
    }

    fn is_system_file(path: &std::path::Path) -> bool {
        if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
            // Unix hidden files
            if name.starts_with('.') {
                return true;
            }
        }

        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if let Ok(meta) = path.metadata() {
                const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
                if meta.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0 {
                    return true;
                }
            }
        }

        false
    }


    // Collect all files
    // Collect (path, hash) together so metadata is only read once
    let all_files: Arc<Mutex<Vec<(std::path::PathBuf, u64)>>> = Arc::new(Mutex::new(Vec::new()));

    for saved_path in &paths {
        if let Some(p) = saved_path.path.as_path() {
            if p.is_dir() {
                let collected = Arc::clone(&all_files);
                WalkBuilder::new(p)
                    .hidden(false)
                    .filter_entry(|e| !is_system_file(e.path()))
                    .build_parallel()
                    .run(|| {
                        let collected = Arc::clone(&collected);
                        Box::new(move |entry| {
                            use ignore::WalkState;
                            if let Ok(e) = entry {
                                if let Ok(meta) = e.metadata() {
                                    if meta.is_file() {
                                        collected
                                            .lock()
                                            .unwrap()
                                            .push((e.path().to_path_buf(), hash_from_meta(&meta)));
                                    }
                                }
                            }
                            WalkState::Continue
                        })
                    });
            }
        }
    }

    let all_files = Arc::try_unwrap(all_files).unwrap().into_inner().unwrap();

    // Parallel hashing & FileEntry construction
    let file_entries: Vec<FileEntry> = all_files
        .into_par_iter()
        .map(|(path, hash_val)| {
            // <-- destructure the tuple
            let id = next_id.fetch_add(1, Ordering::SeqCst);
            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or("unknown".to_string());

            // hash_val already computed above, no fast_file_id call needed
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

            let hash_string = format!("{:x}", hash_val);

            let bookmark = resolve_bookmark(&hash_string, &global_bookmarks, &local_bookmarks);

            FileEntry {
                id,
                name,
                path: FilePath::Path(path),
                excluded,
                hash: Some(hash_string),
                bookmark,
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

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn open_and_wait(path: &str, _show_cmd: bool) -> std::io::Result<()> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(path)
            .spawn()
            .map(|_| ())
    }

    #[cfg(target_os = "linux")]
    {
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
    let _settings = get_app_settings(app.clone())?;
    // Only allow tracking on Windows
    #[cfg(target_os = "windows")]
    let allow_tracking = _settings.file_randomiser.allow_process_tracking;
    #[cfg(not(target_os = "windows"))]
    let allow_tracking = false;

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

fn compute_bookmark_factor(
    file: &FileEntry,
    settings: &crate::models::settings::AppSettings,
) -> f64 {
    let pref = &settings.file_randomiser.bookmark_preference;

    if !pref.enabled {
        return 1.0;
    }

    // No bookmark, or bookmark has no colour → treat as a regular file
    let bookmark = match &file.bookmark {
        Some(b) if b.color.is_some() => b,
        _ => return 1.0,
    };

    let key = bookmark.color.as_ref().unwrap().to_uppercase();

    match pref.colors.iter().find(|(k, _)| k.to_uppercase() == key) {
        Some((_, entry)) => {
            let w = if bookmark.is_global {
                entry.global
            } else {
                entry.local
            };
            // Never let a misconfigured weight completely zero out a file
            w.max(0.0001)
        }
        None => 1.0,
    }
}

fn debug_log(flags: &crate::models::DebugFlags, msg: &str) {
    eprintln!("{}", msg);
    if let Some(file_lock) = &flags.log_file {
        use std::io::Write;
        if let Ok(mut f) = file_lock.lock() {
            let _ = writeln!(f, "{}", msg);
        }
    }
}

fn find_path_weight(path: &str, weights: &HashMap<String, f64>) -> f64 {
    weights.get(path).copied().unwrap_or_else(|| {
        weights
            .iter()
            .filter(|(k, _)| path.starts_with(k.as_str()))
            .max_by_key(|(k, _)| k.len())
            .map(|(_, v)| *v)
            .unwrap_or(1.0)
    })
}

#[tauri::command]
pub fn set_preset_path_weights(
    app_data: State<'_, Mutex<AppStateData>>,
    weights: HashMap<String, f64>,
) {
    app_data.lock().unwrap().preset_path_weights = weights;
}

#[tauri::command]
pub fn pick_random_file(
    app: tauri::AppHandle,
    app_data: State<'_, Mutex<AppStateData>>,
) -> Option<FileEntry> {
    let settings = get_app_settings(app.clone()).ok()?;
    let debug = app.state::<crate::models::DebugFlags>();
    let should_log = cfg!(debug_assertions) || debug.randomiser;
    let randomness_level = settings.file_randomiser.randomness_level;

    let r = (randomness_level as f64 / 100.0).clamp(0.0, 1.0);
    let mut rng = rand::rng();

    let mut data = app_data.lock().unwrap();

    let candidates: Vec<(usize, FileEntry)> = data
        .files
        .iter()
        .enumerate()
        .filter(|(_, f)| !f.excluded)
        .map(|(i, f)| (i, f.clone()))
        .collect();

    if candidates.is_empty() {
        return None;
    }

    let len = candidates.len();
    let last_index = candidates
        .iter()
        .position(|(_, f)| Some(f.id) == data.last_picked_id)
        .unwrap_or(0);

    // --- How large a recency window to penalise ---
    // Scales with library size but caps so it doesn't dominate huge libraries.
    // e.g. 50 files → window ~10, 1000 files → window ~50, 10000 → window ~100
    let recency_window = ((len as f64).sqrt() * 3.0).clamp(10.0, 150.0) as usize;

    // --- ORDER BIAS CURVE ---
    // Drops steeply: at r=0.3 it's already ~5%, gone by r=0.5
    // order_influence: r=0 → 1.0, r=0.5 → ~0.02, r=1 → 0.0
    let order_influence = (1.0 - r).powf(4.0);

    // --- MEMORY PENALTY CURVE ---
    // Peaks around r=0.5, fades toward r=1 (pure chaos needs no memory)
    // memory_influence: r=0 → 0.0, r=0.5 → 1.0, r=1 → 0.0
    let memory_influence = (4.0 * r * (1.0 - r)).min(1.0); // parabola peaking at r=0.5

    let weights: Vec<f64> = candidates
        .iter()
        .map(|(idx, file)| {
            // --- Order weight ---
            // Gaussian centred on next file (distance=1), tight sigma
            let fwd_dist = ((*idx + len - last_index) % len) as f64;
            let sigma = (len as f64 * 0.03).max(1.5); // ~3% of library width, always at least 1.5
            let order_w = (-((fwd_dist - 1.0).powi(2)) / (2.0 * sigma * sigma)).exp();

            // --- Memory (recency) penalty ---
            // Check position in recency list: 0 = picked last, recency_window-1 = oldest in window
            // Bookmark factor — exempt bookmarked files from recency penalty entirely
            let recency_penalty = if Some(file.id) == data.last_picked_id {
                if file
                    .bookmark
                    .as_ref()
                    .and_then(|b| b.color.as_ref())
                    .is_some()
                {
                    0.3
                } else {
                    0.0
                }
            } else if let Some(pos) = data.recency_list.iter().rev().position(|&id| id == file.id) {
                if pos < recency_window {
                    // sqrt fade: stays suppressed longer, recovers slowly near the end
                    let fade = (pos as f64 / recency_window as f64).sqrt();
                    let full_penalty = 1.0 - fade;
                    if file
                        .bookmark
                        .as_ref()
                        .and_then(|b| b.color.as_ref())
                        .is_some()
                    {
                        full_penalty.max(0.8)
                    } else {
                        full_penalty.max(0.05) // never fully zero, just very unlikely
                    }
                } else {
                    1.0
                }
            } else {
                1.0
            };

            // memory_factor: at full memory_influence, recently played files
            // get weight multiplied by recency_penalty (near 0 for just-played)
            let memory_factor = 1.0 - memory_influence * (1.0 - recency_penalty);

            // --- Bookmark preference ---
            let bookmark_factor = compute_bookmark_factor(file, &settings);

            // Fade bookmark influence with randomness
            let bookmark_influence = 1.0 - (r * 0.7);
            // r=0 → full effect
            // r=1 → 30% effect

            let adjusted_bookmark = 1.0 + (bookmark_factor - 1.0) * bookmark_influence;

            // Path weight — global × preset; most specific prefix wins in each map
            let path_weight = if settings.file_randomiser.path_weights_enabled {
                let path_str = match &file.path {
                    FilePath::Path(p) => p.to_string_lossy().to_string(),
                    FilePath::Url(u) => u.to_string(),
                };
                find_path_weight(&path_str, &settings.file_randomiser.path_weights)
                    * find_path_weight(&path_str, &data.preset_path_weights)
            } else {
                1.0
            };

            // --- Combine everything ---
            let base = 1.0 + order_w * order_influence * 10.0;

            (base * memory_factor * adjusted_bookmark * path_weight).max(1e-9)
        })
        .collect();

    // --- Debug: distribution summary ---
    if should_log {
        let bookmarked_weights: Vec<f64> = candidates
            .iter()
            .zip(weights.iter())
            .filter(|((_, f), _)| f.bookmark.as_ref().and_then(|b| b.color.as_ref()).is_some())
            .map(|(_, w)| *w)
            .collect();

        let unbookmarked_weights: Vec<f64> = candidates
            .iter()
            .zip(weights.iter())
            .filter(|((_, f), _)| f.bookmark.as_ref().and_then(|b| b.color.as_ref()).is_none())
            .map(|(_, w)| *w)
            .collect();

        let mean = |v: &[f64]| {
            if v.is_empty() {
                0.0
            } else {
                v.iter().sum::<f64>() / v.len() as f64
            }
        };
        let median = |v: &mut Vec<f64>| {
            if v.is_empty() {
                return 0.0;
            }
            v.sort_by(|a, b| a.partial_cmp(b).unwrap());
            let mid = v.len() / 2;
            if v.len() % 2 == 0 {
                (v[mid - 1] + v[mid]) / 2.0
            } else {
                v[mid]
            }
        };

        let all_min = weights.iter().cloned().fold(f64::INFINITY, f64::min);
        let all_max = weights.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        let all_mean = mean(&weights);
        let mut weights_clone = weights.clone();
        let all_median = median(&mut weights_clone);

        let recency_penalised = candidates
            .iter()
            .filter(|(_, f)| {
                Some(f.id) == data.last_picked_id
                    || data
                        .recency_list
                        .iter()
                        .rev()
                        .position(|&id| id == f.id)
                        .map(|pos| pos < recency_window)
                        .unwrap_or(false)
            })
            .count();

        debug_log(
            &debug,
            &format!(
                "[pick] r={:.2} | candidates={} | bookmark_pref={}",
                r, len, settings.file_randomiser.bookmark_preference.enabled
            ),
        );
        debug_log(
            &debug,
            &format!(
                "[pick] weights — min={:.3} max={:.3} mean={:.3} median={:.3}",
                all_min, all_max, all_mean, all_median
            ),
        );
        debug_log(
            &debug,
            &format!(
                "[pick] bookmarked={} (avg={:.3}) unbookmarked={} (avg={:.3})",
                bookmarked_weights.len(),
                mean(&bookmarked_weights),
                unbookmarked_weights.len(),
                mean(&unbookmarked_weights)
            ),
        );
        debug_log(
            &debug,
            &format!(
                "[pick] recency_penalised={} (of {} in window)",
                recency_penalised, recency_window
            ),
        );
    }

    let dist = WeightedIndex::new(&weights).ok()?;
    let chosen = dist.sample(&mut rng);
    let (_, file) = candidates[chosen].clone();

    // --- Debug: chosen file factors ---
    if should_log {
        debug_log(
            &debug,
            &format!(
                "[pick] chose — bookmark={} global={} | weight={:.3}",
                file.bookmark
                    .as_ref()
                    .and_then(|b| b.color.as_deref())
                    .unwrap_or("none"),
                file.bookmark.as_ref().map(|b| b.is_global).unwrap_or(false),
                weights[chosen]
            ),
        );
    }

    // --- Update state ---
    data.last_picked_id = Some(file.id);
    *data.pick_counts.entry(file.id).or_insert(0) += 1;

    // Update recency list — push to back, trim front if over 2x window
    // (keep a bit extra so window can shrink without losing history)
    if file
        .bookmark
        .as_ref()
        .and_then(|b| b.color.as_ref())
        .is_none()
    {
        data.recency_list.push(file.id);
    }

    let max_recency_len = recency_window + 10;
    if data.recency_list.len() > max_recency_len {
        let drain_count = data.recency_list.len() - max_recency_len;
        data.recency_list.drain(0..drain_count);
    }

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

#[tauri::command]
pub fn get_file_scores(
    app: tauri::AppHandle,
    app_data: State<'_, Mutex<AppStateData>>,
) -> Result<Vec<FileScore>, String> {
    let settings = get_app_settings(app.clone())?;
    let debug = app.state::<crate::models::DebugFlags>();
    let should_log = cfg!(debug_assertions) || debug.randomiser;
    let randomness_level = settings.file_randomiser.randomness_level;
    let r = (randomness_level as f64 / 100.0).clamp(0.0, 1.0);

    let data = app_data.lock().unwrap();

    let candidates: Vec<(usize, &FileEntry)> = data
        .files
        .iter()
        .enumerate()
        .filter(|(_, f)| !f.excluded)
        .collect();

    if candidates.is_empty() {
        return Ok(vec![]);
    }

    // --- Debug header ---
    if should_log {
        debug_log(
            &debug,
            &format!(
                "[scores] candidates={} | bookmark_pref={}",
                candidates.len(),
                settings.file_randomiser.bookmark_preference.enabled
            ),
        );
    }

    let len = candidates.len();
    let last_index = candidates
        .iter()
        .position(|(_, f)| Some(f.id) == data.last_picked_id)
        .unwrap_or(0);
    let recency_window = ((len as f64).sqrt() * 3.0).clamp(5.0, 150.0) as usize;
    let order_influence = (1.0 - r).powf(3.0);
    let memory_influence = 4.0 * r * (1.0 - r);

    let scores: Vec<FileScore> = candidates
        .iter()
        .map(|(idx, file)| {
            let fwd_dist = ((*idx + len - last_index) % len) as f64;
            let sigma = (len as f64 * 0.03).max(1.5);
            let order_w = (-((fwd_dist - 1.0).powi(2)) / (2.0 * sigma * sigma)).exp();

            let recency_penalty = if Some(file.id) == data.last_picked_id {
                if file
                    .bookmark
                    .as_ref()
                    .and_then(|b| b.color.as_ref())
                    .is_some()
                {
                    0.3
                } else {
                    0.0
                }
            } else if let Some(pos) = data.recency_list.iter().rev().position(|&id| id == file.id) {
                if pos < recency_window {
                    1.0 - (pos as f64 / recency_window as f64)
                } else {
                    1.0
                }
            } else {
                1.0
            };

            let memory_factor = 1.0 - memory_influence * (1.0 - recency_penalty);
            let bookmark_factor = compute_bookmark_factor(file, &settings);
            let bookmark_influence = 1.0 - (r * 0.7);
            let adjusted_bookmark = 1.0 + (bookmark_factor - 1.0) * bookmark_influence;
            let path_weight = if settings.file_randomiser.path_weights_enabled {
                let path_str = match &file.path {
                    FilePath::Path(p) => p.to_string_lossy().to_string(),
                    FilePath::Url(u) => u.to_string(),
                };
                find_path_weight(&path_str, &settings.file_randomiser.path_weights)
                    * find_path_weight(&path_str, &data.preset_path_weights)
            } else {
                1.0
            };

            let base = 1.0 + order_w * order_influence * 10.0;
            let total = (base * memory_factor * adjusted_bookmark * path_weight).max(1e-9);

            FileScore {
                id: file.id,
                name: file.name.clone(),
                is_excluded: file.excluded,
                order_score: order_w * order_influence,
                memory_factor,
                bookmark_factor,
                total_weight: total,
            }
        })
        .collect();

    // --- Debug: distribution summary ---
    if should_log {
        let bookmarked: Vec<&FileScore> =
            scores.iter().filter(|s| s.bookmark_factor > 1.0).collect();
        let unbookmarked: Vec<&FileScore> =
            scores.iter().filter(|s| s.bookmark_factor <= 1.0).collect();

        let mean = |v: &[&FileScore]| -> f64 {
            if v.is_empty() {
                return 0.0;
            }
            v.iter().map(|s| s.total_weight).sum::<f64>() / v.len() as f64
        };

        let all_weights: Vec<f64> = scores.iter().map(|s| s.total_weight).collect();
        let min = all_weights.iter().cloned().fold(f64::INFINITY, f64::min);
        let max = all_weights
            .iter()
            .cloned()
            .fold(f64::NEG_INFINITY, f64::max);
        let total_mean = all_weights.iter().sum::<f64>() / all_weights.len() as f64;
        let recency_penalised = scores.iter().filter(|s| s.memory_factor < 1.0).count();

        debug_log(
            &debug,
            &format!(
                "[scores] weights — min={:.3} max={:.3} mean={:.3}",
                min, max, total_mean
            ),
        );
        debug_log(
            &debug,
            &format!(
                "[scores] bookmarked={} (avg={:.3}) unbookmarked={} (avg={:.3})",
                bookmarked.len(),
                mean(&bookmarked),
                unbookmarked.len(),
                mean(&unbookmarked)
            ),
        );
        debug_log(
            &debug,
            &format!("[scores] recency_penalised={}", recency_penalised),
        );
    }

    Ok(scores)
}

#[tauri::command]
pub fn update_file_bookmark(
    app_data: State<'_, Mutex<AppStateData>>,
    hash: String,
    color: Option<String>,
    is_global: bool,
) -> Result<(), String> {
    let mut data = app_data.lock().unwrap();
    for file in data.files.iter_mut() {
        if file.hash.as_deref() == Some(hash.as_str()) {
            file.bookmark = color.as_ref().map(|c| crate::models::BookmarkInfo {
                color: Some(c.clone()),
                is_global,
            });
        }
    }
    Ok(())
}

#[tauri::command]
pub fn update_file_bookmarks_bulk(
    app_data: State<'_, Mutex<AppStateData>>,
    hashes: Vec<String>,
    color: Option<String>,
    is_global: bool,
) -> Result<(), String> {
    let mut data = app_data.lock().unwrap();
    let hash_set: std::collections::HashSet<&str> = hashes.iter().map(|h| h.as_str()).collect();
    for file in data.files.iter_mut() {
        if let Some(hash) = &file.hash {
            if hash_set.contains(hash.as_str()) {
                file.bookmark = color.as_ref().map(|c| crate::models::BookmarkInfo {
                    color: Some(c.clone()),
                    is_global,
                });
            }
        }
    }
    Ok(())
}
