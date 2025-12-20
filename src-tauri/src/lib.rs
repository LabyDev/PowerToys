use std::sync::Mutex;
pub mod context;
mod filerandomisercommands;
mod models;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(context::AppState {
            enable_context_menu: Mutex::new(false),
        })
        .manage(Mutex::new(models::file_randomiser_models::AppStateData {
            paths: vec![],
            files: vec![],
            history: vec![],
        }))
        .invoke_handler(tauri::generate_handler![
            filerandomisercommands::get_app_state,
            filerandomisercommands::add_path_via_dialog,
            context::get_app_settings,
            context::toggle_context_menu_item
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
