use std::{collections::HashMap, sync::Mutex};
mod filerandomisercommands;
pub mod models;
pub mod setting_commands;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(models::settings::AppSettings::default())
        .manage(Mutex::new(models::file_randomiser_models::AppStateData {
            paths: vec![],
            files: vec![],
            history: vec![],
            tracking_enabled: false,
            filter_rules: vec![],
            last_picked_id: None,
            pick_counts: HashMap::new(),
        }))
        .invoke_handler(tauri::generate_handler![
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
