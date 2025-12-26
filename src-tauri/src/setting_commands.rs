use crate::context::windows_shell::is_context_menu_registered;
use crate::models::settings::AppSettings;
use crate::models::DarkModeOption;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Wry};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_dialog::FilePath;
use base64::{engine::general_purpose, Engine as _};
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
pub fn set_custom_background(app: tauri::AppHandle<Wry>) -> Result<AppSettings, String> {
    // Pick file
    let file_path_opt = app.dialog().file().blocking_pick_file();
    let file_path = file_path_opt.ok_or("No file selected")?;

    // Convert to owned PathBuf
    let path_buf: PathBuf = match file_path {
        FilePath::Path(p) => p,
        FilePath::Url(url) => url.to_file_path().map_err(|_| "URL not a file path")?,
    };

    // Read file bytes
    let bytes = fs::read(&path_buf).map_err(|e| format!("Failed to read file: {}", e))?;

    // Encode using the new Engine API
    let encoded = general_purpose::STANDARD.encode(&bytes);

    // Get extension
    let ext = path_buf
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png");

    // Build data URL
    let data_url = format!("data:image/{};base64,{}", ext, encoded);

    // Save in settings
    let mut settings = get_app_settings(app.clone())?;
    settings.custom_background = Some(data_url);
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
