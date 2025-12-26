use crate::context::windows_shell::is_context_menu_registered;
use crate::models::settings::AppSettings;
use crate::models::DarkModeOption;
use tauri::{AppHandle, Wry};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_dialog::FilePath;
use tauri_plugin_store::StoreExt;

/// Get the current settings, merging persisted store + runtime context menu status
#[tauri::command]
pub fn get_app_settings(app: AppHandle<Wry>) -> Result<AppSettings, String> {
    let store = app.store("store.json").map_err(|e| e.to_string())?;

    let mut settings: AppSettings = match store.get("settings") {
        Some(value) => serde_json::from_value(value).unwrap_or_default(),
        None => AppSettings::default(),
    };

    // Override enable_context_menu with the actual Windows state
    settings.file_randomiser.enable_context_menu = is_context_menu_registered();

    Ok(settings)
}

/// Save updated settings to the persistent store
#[tauri::command]
pub fn set_app_settings(app: AppHandle<Wry>, settings: AppSettings) -> Result<AppSettings, String> {
    let store = app.store("store.json").map_err(|e| e.to_string())?;
    store.set("settings", serde_json::to_value(&settings).unwrap());
    store.save().map_err(|e| e.to_string())?;
    Ok(settings)
}

/// Toggle process tracking
#[tauri::command]
pub fn toggle_process_tracking(app: AppHandle<Wry>, enable: bool) -> Result<AppSettings, String> {
    let mut settings = get_app_settings(app.clone())?;
    settings.file_randomiser.allow_process_tracking = enable;
    set_app_settings(app, settings.clone())?;
    Ok(settings)
}

/// Set dark mode
#[tauri::command]
pub fn set_dark_mode(app: AppHandle<Wry>, mode: DarkModeOption) -> Result<AppSettings, String> {
    let mut settings = get_app_settings(app.clone())?;
    settings.dark_mode = mode;
    set_app_settings(app, settings.clone())?;
    Ok(settings)
}

/// Set custom background via file dialog
#[tauri::command]
pub fn set_custom_background(app: AppHandle<Wry>) -> Result<AppSettings, String> {
    // Open file dialog using Tauri plugin
    let file: FilePath = app
        .dialog()
        .file()
        .blocking_pick_file()
        .ok_or("No file selected")?;

    let mut settings = get_app_settings(app.clone())?;
    settings.custom_background = Some(
        file.as_path()
            .and_then(|p| p.to_str())
            .unwrap_or_default()
            .to_string(),
    );
    set_app_settings(app, settings.clone())?;
    Ok(settings)
}

/// Clear the custom background
#[tauri::command]
pub fn clear_custom_background(app: AppHandle<Wry>) -> Result<AppSettings, String> {
    let mut settings = get_app_settings(app.clone())?;
    settings.custom_background = None; // clear the background
    set_app_settings(app, settings.clone())?;
    Ok(settings)
}
