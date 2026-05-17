use crate::models::{DebugFlags, FileSorterState};
use std::sync::Mutex;
mod fileauditorcommands;
mod filerandomisercommands;
mod filesortercommands;
pub mod models;
pub mod setting_commands;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let debug_randomiser = args.contains(&"--debug-randomiser".to_string());

    let log_file = args
        .iter()
        .position(|a| a == "--log-file")
        .and_then(|i| args.get(i + 1))
        .map(|path| {
            std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
                .map_err(|e| eprintln!("Failed to open log file: {}", e))
                .ok()
        })
        .flatten()
        .map(std::sync::Mutex::new);

    tauri::Builder::default()
        // Plugins
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        // App state
        .manage(models::settings::AppSettings::default())
        .manage(Mutex::new(
            models::file_randomiser_models::AppStateData::default(),
        ))
        .manage(DebugFlags {
            randomiser: debug_randomiser,
            log_file,
        })
        .manage(filesortercommands::UndoStack(Mutex::new(Vec::new())))
        .manage(Mutex::new(FileSorterState::default()))
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
            fileauditorcommands::delete_to_trash
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
