use crate::models::{AppStateData, FileSorterState, PersistedStats};
use crate::filerandomisercommands::{prune_history, PathPickCounts};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;
mod fileauditorcommands;
mod filerandomisercommands;
mod filesortercommands;
pub mod models;
pub mod setting_commands;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Plugins
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // App state
        .manage(models::settings::AppSettings::default())
        .manage(Mutex::new(AppStateData::default()))
        .manage(PathPickCounts(Mutex::new(HashMap::new())))
        .manage(filesortercommands::UndoStack(Mutex::new(Vec::new())))
        .manage(Mutex::new(FileSorterState::default()))
        .manage(fileauditorcommands::TrackedProcessMap(Mutex::new(
            std::collections::HashMap::new(),
        )))
        .setup(|app| {
            let handle = app.handle().clone();
            let stats_path = handle
                .path()
                .app_data_dir()
                .ok()
                .map(|d: std::path::PathBuf| d.join("randomiser_stats.json"));
            if let Some(path) = stats_path {
                if let Ok(content) = std::fs::read_to_string(path) {
                    if let Ok(stats) = serde_json::from_str::<PersistedStats>(&content) {
                        let retention_days = setting_commands::get_app_settings(handle.clone())
                            .ok()
                            .map(|s| s.file_randomiser.history_retention_days)
                            .unwrap_or(180);
                        let mut history = stats.history;
                        prune_history(&mut history, retention_days);
                        {
                            let app_data = handle.state::<Mutex<AppStateData>>();
                            let mut data = app_data.lock().unwrap();
                            data.history = history;
                        }
                        {
                            let counts = handle.state::<PathPickCounts>();
                            *counts.0.lock().unwrap() = stats.path_pick_counts;
                        }
                    }
                }
            }
            Ok(())
        })
        // Command handlers
        .invoke_handler(tauri::generate_handler![
            // Settings
            setting_commands::get_app_settings,
            setting_commands::set_app_settings,
            setting_commands::toggle_process_tracking,
            setting_commands::set_dark_mode,
            setting_commands::set_custom_background,
            setting_commands::clear_custom_background,
            setting_commands::set_randomness_level,
            setting_commands::restart_app,
            setting_commands::set_language,
            setting_commands::get_global_bookmarks,
            setting_commands::set_global_bookmarks,
            setting_commands::open_settings_folder,
            setting_commands::set_file_auditor_keybinds,
            setting_commands::toggle_auditor_process_tracking,
            // File randomiser
            filerandomisercommands::get_app_state,
            filerandomisercommands::add_path_via_dialog,
            filerandomisercommands::remove_path,
            filerandomisercommands::crawl_paths,
            filerandomisercommands::pick_random_file,
            filerandomisercommands::open_file_by_id,
            filerandomisercommands::update_app_state,
            filerandomisercommands::open_presets_folder,
            filerandomisercommands::get_presets,
            filerandomisercommands::save_preset,
            filerandomisercommands::open_path,
            filerandomisercommands::get_file_scores,
            filerandomisercommands::set_preset_path_weights,
            filerandomisercommands::update_file_bookmark,
            filerandomisercommands::update_file_bookmarks_bulk,
            filerandomisercommands::save_csv,
            // File sorter
            filesortercommands::get_sorter_state,
            filesortercommands::select_sort_directory,
            filesortercommands::get_sort_preview,
            filesortercommands::sort_files,
            filesortercommands::restore_last_sort,
            filesortercommands::set_similarity_threshold,
            filesortercommands::include_path,
            filesortercommands::exclude_path,
            filesortercommands::force_target,
            filesortercommands::reveal_in_explorer,
            // File auditor
            fileauditorcommands::pick_audit_folder,
            fileauditorcommands::audit_list_files,
            fileauditorcommands::open_audit_file,
            fileauditorcommands::forget_tracked_file,
            fileauditorcommands::close_tracked_file,
            fileauditorcommands::delete_to_trash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
