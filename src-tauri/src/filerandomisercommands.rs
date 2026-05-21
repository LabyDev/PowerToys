use crate::models::common::hash_from_meta;
use crate::models::{
    AppStateData, Bookmark, FileEntry, FileScore, FilterMatchType, FilterRule, HistoryEntry,
    PersistedStats, SavedPath,
};
use crate::models::{FilterAction, RandomiserPreset};
use crate::setting_commands::get_app_settings;
use chrono::Utc;
use ignore::WalkBuilder;
use rand::distr::weighted::WeightedIndex;
use rand::prelude::*;
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;
use tauri::State;
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_opener::OpenerExt;

pub struct PathPickCounts(pub Mutex<HashMap<String, u32>>);

fn stats_file_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|d| d.join("randomiser_stats.json"))
}

pub fn prune_history(history: &mut Vec<crate::models::HistoryEntry>, retention_days: u32) {
    if retention_days == 0 {
        return;
    }
    let cutoff = Utc::now() - chrono::Duration::days(retention_days as i64);
    history.retain(|h| h.opened_at >= cutoff);
}

fn save_persisted_stats(app: &tauri::AppHandle, data: &AppStateData) {
    let Some(path) = stats_file_path(app) else {
        return;
    };
    let settings = get_app_settings(app.clone()).ok();
    let retention_days = settings
        .as_ref()
        .map(|s| s.file_randomiser.history_retention_days)
        .unwrap_or(180);
    let persist_recency = settings
        .as_ref()
        .map(|s| s.file_randomiser.persist_recency)
        .unwrap_or(false);

    let mut history = data.history.clone();
    prune_history(&mut history, retention_days);
    let path_pick_counts: HashMap<String, u32> = data
        .files
        .iter()
        .filter_map(|f| {
            let count = *data.pick_counts.get(&f.id)?;
            if count == 0 {
                return None;
            }
            let path_str = match &f.path {
                FilePath::Path(p) => p.to_string_lossy().to_string(),
                FilePath::Url(u) => u.to_string(),
            };
            Some((path_str, count))
        })
        .collect();

    let recency_list_paths: Vec<String> = if persist_recency {
        data.recency_list
            .iter()
            .filter_map(|id| data.files.iter().find(|f| f.id == *id))
            .map(|f| match &f.path {
                FilePath::Path(p) => p.to_string_lossy().to_string(),
                FilePath::Url(u) => u.to_string(),
            })
            .collect()
    } else {
        vec![]
    };

    let stats = PersistedStats {
        history,
        path_pick_counts,
        recency_list_paths,
    };
    if let Ok(json) = serde_json::to_string_pretty(&stats) {
        let _ = std::fs::write(path, json);
    }
}

#[tauri::command]
pub fn save_csv(app: tauri::AppHandle, filename: String, content: String) -> Result<(), String> {
    let path = app
        .dialog()
        .file()
        .add_filter("CSV", &["csv"])
        .set_file_name(&filename)
        .blocking_save_file();
    match path {
        Some(FilePath::Path(p)) => std::fs::write(p, content).map_err(|e| e.to_string()),
        Some(FilePath::Url(_)) => Err("URL paths not supported for CSV export".to_string()),
        None => Ok(()), // user cancelled
    }
}

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
    app: tauri::AppHandle,
    app_data: State<'_, Mutex<AppStateData>>,
    path_pick_counts: State<'_, PathPickCounts>,
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

    data.files = file_entries;

    // Remap persisted path-keyed pick counts to current file IDs
    let persisted = path_pick_counts.0.lock().unwrap();
    data.pick_counts = data
        .files
        .iter()
        .filter_map(|f| {
            let path_str = match &f.path {
                FilePath::Path(p) => p.to_string_lossy().to_string(),
                FilePath::Url(u) => u.to_string(),
            };
            persisted.get(&path_str).map(|&count| (f.id, count))
        })
        .collect();

    // Remap persisted recency list (paths → IDs) when persist_recency is enabled
    let persist_recency = get_app_settings(app.clone())
        .ok()
        .map(|s| s.file_randomiser.persist_recency)
        .unwrap_or(false);
    if persist_recency {
        if let Some(stats_path) = stats_file_path(&app) {
            if let Ok(content) = std::fs::read_to_string(stats_path) {
                if let Ok(stats) = serde_json::from_str::<crate::models::PersistedStats>(&content) {
                    if !stats.recency_list_paths.is_empty() {
                        let recency_window =
                            ((data.files.len() as f64).sqrt() * 4.0).clamp(15.0, 200.0) as usize;
                        let path_to_id: HashMap<String, u64> = data
                            .files
                            .iter()
                            .map(|f| {
                                let p = match &f.path {
                                    FilePath::Path(p) => p.to_string_lossy().to_string(),
                                    FilePath::Url(u) => u.to_string(),
                                };
                                (p, f.id)
                            })
                            .collect();
                        let remapped: Vec<u64> = stats
                            .recency_list_paths
                            .iter()
                            .filter_map(|p| path_to_id.get(p).copied())
                            .collect();
                        let start = remapped.len().saturating_sub(recency_window * 2);
                        data.recency_list = remapped[start..].to_vec();
                    }
                }
            }
        }
    }

    data.files.clone()
}

#[cfg(target_os = "windows")]
fn open_and_wait(path: &str, show_cmd: bool) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    if show_cmd {
        Command::new("cmd")
            .args(["/C", "start", "/WAIT", "", path])
            .status()?;
    } else {
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
            .args(["-W", path])
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
fn open_and_wait(path: &str, _show_cmd: bool) -> std::io::Result<()> {
    std::process::Command::new("gio")
        .args(["open", path])
        .spawn()
        .map(|_| ())
}

pub fn open_file_tracked(
    app: tauri::AppHandle,
    path: String,
    id: Option<u64>,
    name: Option<String>,
    diagnostics: Option<crate::models::PickDiagnostics>,
) -> Result<(), String> {
    let _settings = get_app_settings(app.clone())?;
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    let allow_tracking = _settings.file_randomiser.allow_process_tracking;
    #[cfg(target_os = "linux")]
    let allow_tracking = false;

    if let (Some(id), Some(name)) = (id, name) {
        let app_data_lock = app.state::<Mutex<AppStateData>>();
        let mut state = app_data_lock.lock().unwrap();
        state.history.push(HistoryEntry {
            id,
            name,
            path: FilePath::Path(path.clone().into()),
            opened_at: Utc::now(),
            diagnostics,
        });
        save_persisted_stats(&app, &state);
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
    let recency_window = ((len as f64).sqrt() * 4.0).clamp(15.0, 200.0) as usize;

    // --- ORDER BIAS CURVE ---
    // Drops very steeply so mid-randomness doesn't visibly favour the next-in-order file.
    // order_influence: r=0 → 1.0, r=0.5 → ~0.016, r=1 → 0.0
    let order_influence = (1.0 - r).powf(6.0);

    // --- MEMORY PENALTY CURVE ---
    // Saturating curve: more randomness → more anti-repeat. Stays meaningful at r=1
    // so "full random" never collapses into pure weighted-uniform (avoids visible streaks).
    // memory_influence: r=0 → 0.5 (floored), r=0.5 → 0.75, r=1 → 1.0
    let memory_influence = (1.0 - (1.0 - r).powi(2)).max(0.5);

    // --- STREAK SUPPRESSION ---
    // Track the last few picks' bookmark colour and parent folder. Files matching
    // those get a soft weight penalty so picks "feel" less clustered to humans.
    // Disabled at r=1.0 (the user explicitly asked for raw weighted sampling).
    let streaks_enabled = r < 1.0;
    let recent_streak_meta: Vec<(Option<String>, Option<String>)> = if streaks_enabled {
        // Use the actual pick history (last 3 entries by openedAt) so bookmarked
        // picks are included — recency_list intentionally skips them.
        let mut hist: Vec<&crate::models::HistoryEntry> = data.history.iter().collect();
        hist.sort_by_key(|h| h.opened_at);
        hist.iter()
            .rev()
            .take(3)
            .filter_map(|h| data.files.iter().find(|f| f.id == h.id))
            .map(|f| {
                let color = f
                    .bookmark
                    .as_ref()
                    .and_then(|b| b.color.clone())
                    .map(|c| c.to_uppercase());
                let folder = match &f.path {
                    FilePath::Path(p) => p
                        .parent()
                        .map(|pp| pp.to_string_lossy().to_string()),
                    FilePath::Url(_) => None,
                };
                (color, folder)
            })
            .collect()
    } else {
        Vec::new()
    };

    let total_picks: u32 = candidates
        .iter()
        .map(|(_, f)| data.pick_counts.get(&f.id).copied().unwrap_or(0))
        .sum();
    let avg_picks = total_picks as f64 / candidates.len() as f64;

    // Build weights and capture per-candidate factor breakdown so we can attach
    // a diagnostics row to the resulting HistoryEntry (for tuning/export later).
    let mut order_scores = Vec::with_capacity(len);
    let mut memory_factors = Vec::with_capacity(len);
    let mut color_streak_factors = Vec::with_capacity(len);
    let mut folder_streak_factors = Vec::with_capacity(len);
    let weights: Vec<f64> = candidates
        .iter()
        .map(|(idx, file)| {
            let fwd_dist = ((*idx + len - last_index) % len) as f64;
            let sigma = (len as f64 * 0.03).max(1.5);
            let order_w = (-((fwd_dist - 1.0).powi(2)) / (2.0 * sigma * sigma)).exp();

            let recency_penalty = if Some(file.id) == data.last_picked_id {
                0.0
            } else if let Some(pos) = data.recency_list.iter().rev().position(|&id| id == file.id) {
                if pos < recency_window {
                    let frac = pos as f64 / recency_window as f64;
                    frac.powf(1.5)
                } else {
                    1.0
                }
            } else {
                1.0
            };

            let memory_factor = 1.0 - memory_influence * (1.0 - recency_penalty);
            let adjusted_bookmark = compute_bookmark_factor(file, &settings);
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

            let file_picks = data.pick_counts.get(&file.id).copied().unwrap_or(0) as f64;
            let coverage_factor = ((avg_picks + 1.0) / (file_picks + 1.0)).sqrt();

            // Streak suppression. Bookmark colour always applies; folder is
            // softened proportional to user-set path weight so a 5x folder
            // can still get streaks (the user explicitly asked for it).
            let (color_streak, folder_streak) = if streaks_enabled {
                let file_color = file
                    .bookmark
                    .as_ref()
                    .and_then(|b| b.color.as_ref())
                    .map(|c| c.to_uppercase());
                let file_folder = match &file.path {
                    FilePath::Path(p) => p
                        .parent()
                        .map(|pp| pp.to_string_lossy().to_string()),
                    FilePath::Url(_) => None,
                };

                let mut color_f = 1.0_f64;
                if let Some(fc) = &file_color {
                    if let Some((prev_c, _)) = recent_streak_meta.first() {
                        if prev_c.as_deref() == Some(fc.as_str()) {
                            color_f = 0.4;
                        }
                    }
                    if color_f >= 1.0
                        && recent_streak_meta
                            .iter()
                            .any(|(c, _)| c.as_deref() == Some(fc.as_str()))
                    {
                        color_f = 0.7;
                    }
                }

                let mut raw_folder_f = 1.0_f64;
                if let Some(ff) = &file_folder {
                    if let Some((_, prev_f)) = recent_streak_meta.first() {
                        if prev_f.as_deref() == Some(ff.as_str()) {
                            raw_folder_f = 0.5;
                        }
                    }
                    if raw_folder_f >= 1.0
                        && recent_streak_meta
                            .iter()
                            .any(|(_, f)| f.as_deref() == Some(ff.as_str()))
                    {
                        raw_folder_f = 0.8;
                    }
                }
                let folder_f = if path_weight > 1.0 {
                    let t = ((path_weight - 1.0) / 4.0).clamp(0.0, 1.0);
                    raw_folder_f + (1.0 - raw_folder_f) * t
                } else {
                    raw_folder_f
                };

                (color_f, folder_f)
            } else {
                (1.0, 1.0)
            };

            let base = 1.0 + order_w * order_influence * 10.0;
            order_scores.push(order_w);
            memory_factors.push(memory_factor);
            color_streak_factors.push(color_streak);
            folder_streak_factors.push(folder_streak);
            (base
                * memory_factor
                * adjusted_bookmark
                * path_weight
                * coverage_factor
                * color_streak
                * folder_streak)
                .max(1e-9)
        })
        .collect();

    // --- Hard anti-repeat: never pick any of the last N picks when alternatives exist ---
    // N scales with recency window. For ~450 files this blocks ~28 recent picks.
    let mut weights = weights;
    let hard_block_n = ((recency_window / 5).max(3)).min(20);
    let blocked: std::collections::HashSet<u64> = data
        .last_picked_id
        .iter()
        .copied()
        .chain(data.recency_list.iter().rev().take(hard_block_n).copied())
        .collect();
    let blockable = len.saturating_sub(blocked.len());
    if blockable >= 1 {
        for (i, (_, f)) in candidates.iter().enumerate() {
            if blocked.contains(&f.id) {
                weights[i] = 0.0;
            }
        }
    }

    let dist = WeightedIndex::new(&weights).ok()?;
    let chosen = dist.sample(&mut rng);
    let (_, file) = candidates[chosen].clone();

    // --- Build diagnostics for this pick ---
    let diagnostics = {
        let mean = |v: &[f64]| {
            if v.is_empty() {
                0.0
            } else {
                v.iter().sum::<f64>() / v.len() as f64
            }
        };
        let mut sorted = weights.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        let median = if sorted.is_empty() {
            0.0
        } else if sorted.len() % 2 == 0 {
            (sorted[sorted.len() / 2 - 1] + sorted[sorted.len() / 2]) / 2.0
        } else {
            sorted[sorted.len() / 2]
        };
        let weight_min = weights.iter().cloned().fold(f64::INFINITY, f64::min);
        let weight_max = weights.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

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

        crate::models::PickDiagnostics {
            randomness_level,
            candidates: len as u32,
            bookmark_pref_enabled: settings.file_randomiser.bookmark_preference.enabled,
            recency_window: recency_window as u32,
            recency_penalised: recency_penalised as u32,
            weight_min,
            weight_max,
            weight_mean: mean(&weights),
            weight_median: median,
            bookmarked_count: bookmarked_weights.len() as u32,
            bookmarked_mean: mean(&bookmarked_weights),
            unbookmarked_count: unbookmarked_weights.len() as u32,
            unbookmarked_mean: mean(&unbookmarked_weights),
            chosen_weight: weights[chosen],
            chosen_order_score: order_scores[chosen],
            chosen_memory_factor: memory_factors[chosen],
            chosen_color_streak_factor: color_streak_factors[chosen],
            chosen_folder_streak_factor: folder_streak_factors[chosen],
            chosen_bookmark_color: file.bookmark.as_ref().and_then(|b| b.color.clone()),
            chosen_bookmark_global: file.bookmark.as_ref().map(|b| b.is_global).unwrap_or(false),
        }
    };

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

    let _ = app.emit("file-picked", ());
    let _ = open_file_tracked(
        app,
        match &file.path {
            FilePath::Path(p) => p.to_string_lossy().to_string(),
            FilePath::Url(u) => u.to_string(),
        },
        Some(file.id),
        Some(file.name.clone()),
        Some(diagnostics),
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

    let _ = app.emit("file-picked", ());
    let _ = open_file_tracked(
        app.clone(),
        match &file.path {
            FilePath::Path(p) => p.to_string_lossy().to_string(),
            FilePath::Url(u) => u.clone().to_string(),
        },
        Some(file.id),
        Some(file.name.clone()),
        None,
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

    let len = candidates.len();
    let last_index = candidates
        .iter()
        .position(|(_, f)| Some(f.id) == data.last_picked_id)
        .unwrap_or(0);
    let recency_window = ((len as f64).sqrt() * 4.0).clamp(15.0, 200.0) as usize;
    let order_influence = (1.0 - r).powf(6.0);
    let memory_influence = (1.0 - (1.0 - r).powi(2)).max(0.5);

    let streaks_enabled = r < 1.0;
    let recent_streak_meta: Vec<(Option<String>, Option<String>)> = if streaks_enabled {
        let mut hist: Vec<&crate::models::HistoryEntry> = data.history.iter().collect();
        hist.sort_by_key(|h| h.opened_at);
        hist.iter()
            .rev()
            .take(3)
            .filter_map(|h| data.files.iter().find(|f| f.id == h.id))
            .map(|f| {
                let color = f
                    .bookmark
                    .as_ref()
                    .and_then(|b| b.color.clone())
                    .map(|c| c.to_uppercase());
                let folder = match &f.path {
                    FilePath::Path(p) => p
                        .parent()
                        .map(|pp| pp.to_string_lossy().to_string()),
                    FilePath::Url(_) => None,
                };
                (color, folder)
            })
            .collect()
    } else {
        Vec::new()
    };

    let hard_block_n = ((recency_window / 5).max(3)).min(20);
    let blocked: std::collections::HashSet<u64> = data
        .last_picked_id
        .iter()
        .copied()
        .chain(data.recency_list.iter().rev().take(hard_block_n).copied())
        .collect();
    let any_unblocked = len > blocked.len();

    let total_picks: u32 = candidates
        .iter()
        .map(|(_, f)| data.pick_counts.get(&f.id).copied().unwrap_or(0))
        .sum();
    let avg_picks = total_picks as f64 / candidates.len() as f64;

    let scores: Vec<FileScore> = candidates
        .iter()
        .map(|(idx, file)| {
            let fwd_dist = ((*idx + len - last_index) % len) as f64;
            let sigma = (len as f64 * 0.03).max(1.5);
            let order_w = (-((fwd_dist - 1.0).powi(2)) / (2.0 * sigma * sigma)).exp();

            let is_last_picked = Some(file.id) == data.last_picked_id;
            let recency_penalty = if is_last_picked {
                0.0
            } else if let Some(pos) = data.recency_list.iter().rev().position(|&id| id == file.id) {
                if pos < recency_window {
                    let frac = pos as f64 / recency_window as f64;
                    frac.powf(1.5)
                } else {
                    1.0
                }
            } else {
                1.0
            };

            let memory_factor = 1.0 - memory_influence * (1.0 - recency_penalty);
            let bookmark_factor = compute_bookmark_factor(file, &settings);
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

            let file_picks = data.pick_counts.get(&file.id).copied().unwrap_or(0) as f64;
            let coverage_factor = ((avg_picks + 1.0) / (file_picks + 1.0)).sqrt();

            let (color_streak, folder_streak) = if streaks_enabled {
                let file_color = file
                    .bookmark
                    .as_ref()
                    .and_then(|b| b.color.as_ref())
                    .map(|c| c.to_uppercase());
                let file_folder = match &file.path {
                    FilePath::Path(p) => p
                        .parent()
                        .map(|pp| pp.to_string_lossy().to_string()),
                    FilePath::Url(_) => None,
                };
                let mut color_f = 1.0_f64;
                if let Some(fc) = &file_color {
                    if let Some((prev_c, _)) = recent_streak_meta.first() {
                        if prev_c.as_deref() == Some(fc.as_str()) {
                            color_f = 0.4;
                        }
                    }
                    if color_f >= 1.0
                        && recent_streak_meta
                            .iter()
                            .any(|(c, _)| c.as_deref() == Some(fc.as_str()))
                    {
                        color_f = 0.7;
                    }
                }
                let mut raw_folder_f = 1.0_f64;
                if let Some(ff) = &file_folder {
                    if let Some((_, prev_f)) = recent_streak_meta.first() {
                        if prev_f.as_deref() == Some(ff.as_str()) {
                            raw_folder_f = 0.5;
                        }
                    }
                    if raw_folder_f >= 1.0
                        && recent_streak_meta
                            .iter()
                            .any(|(_, f)| f.as_deref() == Some(ff.as_str()))
                    {
                        raw_folder_f = 0.8;
                    }
                }
                let folder_f = if path_weight > 1.0 {
                    let t = ((path_weight - 1.0) / 4.0).clamp(0.0, 1.0);
                    raw_folder_f + (1.0 - raw_folder_f) * t
                } else {
                    raw_folder_f
                };
                (color_f, folder_f)
            } else {
                (1.0, 1.0)
            };

            let base = 1.0 + order_w * order_influence * 10.0;
            // Mirror pick_random_file: the last N picks are hard-excluded from sampling
            // (as long as at least one candidate remains unblocked), so show their weight as zero.
            let total = if any_unblocked && blocked.contains(&file.id) {
                0.0
            } else {
                (base
                    * memory_factor
                    * bookmark_factor
                    * path_weight
                    * coverage_factor
                    * color_streak
                    * folder_streak)
                    .max(1e-9)
            };

            FileScore {
                id: file.id,
                name: file.name.clone(),
                is_excluded: file.excluded,
                order_score: order_w,
                memory_factor,
                bookmark_factor,
                coverage_factor,
                total_weight: total,
            }
        })
        .collect();

    Ok(scores)
}

fn apply_bookmark(
    files: &mut Vec<crate::models::FileEntry>,
    hashes: &std::collections::HashSet<&str>,
    color: &Option<String>,
    is_global: bool,
) {
    for file in files.iter_mut() {
        if let Some(h) = &file.hash {
            if hashes.contains(h.as_str()) {
                file.bookmark = color.as_ref().map(|c| crate::models::BookmarkInfo {
                    color: Some(c.clone()),
                    is_global,
                });
            }
        }
    }
}

#[tauri::command]
pub fn update_file_bookmark(
    app_data: State<'_, Mutex<AppStateData>>,
    hash: String,
    color: Option<String>,
    is_global: bool,
) -> Result<(), String> {
    let mut data = app_data.lock().unwrap();
    let hashes = std::collections::HashSet::from([hash.as_str()]);
    apply_bookmark(&mut data.files, &hashes, &color, is_global);
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
    apply_bookmark(&mut data.files, &hash_set, &color, is_global);
    Ok(())
}
