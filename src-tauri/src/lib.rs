use std::sync::{atomic::AtomicBool, Mutex};
pub mod context;
mod filerandomisercommands;
mod models;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(context::AppState {
            enable_context_menu: Mutex::new(false),
        })
        .manage(Mutex::new(models::file_randomiser_models::AppStateData {
            paths: vec![],
            files: vec![],
            history: vec![],
            tracking_enabled: false,
        }))
        .manage(Mutex::new(models::file_randomiser_models::RuntimeState {
            running: AtomicBool::new(false),
            current_child: Mutex::new(None),
        }))
        .invoke_handler(tauri::generate_handler![
            filerandomisercommands::get_app_state,
            filerandomisercommands::add_path_via_dialog,
            filerandomisercommands::remove_path,
            filerandomisercommands::crawl_paths,
            filerandomisercommands::pick_random_file,
            filerandomisercommands::open_file_by_id,
            filerandomisercommands::start_tracking,
            filerandomisercommands::stop_tracking,
            context::get_app_settings,
            context::toggle_context_menu_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
