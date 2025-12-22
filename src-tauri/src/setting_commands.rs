use crate::models::settings::AppSettings;
use tauri::{AppHandle, Wry};
use tauri_plugin_store::StoreExt;
use crate::context::windows_shell::{is_context_menu_registered};

/// Get the current settings, merging persisted store + runtime context menu status
#[tauri::command]
pub fn get_app_settings(app: AppHandle<Wry>) -> Result<AppSettings, String> {
    let store = app.store("store.json").map_err(|e| e.to_string())?;

    let mut settings: AppSettings = match store.get("settings") {
        Some(value) => serde_json::from_value(value).unwrap_or_default(),
        None => AppSettings::default(),
    };

    // Override enable_context_menu with the actual Windows state
    settings.enable_context_menu = is_context_menu_registered();

    Ok(settings)
}

/// Save updated settings to the persistent store
#[tauri::command]
pub fn set_app_settings(app: AppHandle<Wry>, settings: AppSettings) -> Result<(), String> {
    let store = app.store("store.json").map_err(|e| e.to_string())?;
    store.set("settings", serde_json::to_value(settings).unwrap());
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_process_tracking(app: AppHandle<Wry>, enable: bool) -> Result<AppSettings, String> {
    let mut settings: AppSettings = get_app_settings(app.clone())?;
    settings.allow_process_tracking = enable;
    set_app_settings(app, settings.clone())?;
    Ok(settings)
}