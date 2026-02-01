use crate::models::settings::AppSettings;
use crate::models::Bookmark;
use crate::models::DarkModeOption;
use crate::models::LanguageOption;
use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Wry};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_dialog::FilePath;
use tauri_plugin_store::StoreExt;

/// Get the current settings, merging persisted store + runtime context menu status
#[tauri::command]
pub fn get_app_settings(app: AppHandle<Wry>) -> Result<AppSettings, String> {
    let store = app.store("store.json").map_err(|e| e.to_string())?;

    #[allow(unused_mut)]
    let mut settings: AppSettings = match store.get("settings") {
        Some(value) => serde_json::from_value(value).unwrap_or_default(),
        None => AppSettings::default(),
    };

    // Force-disable process tracking on non-Windows
    #[cfg(not(target_os = "windows"))]
    {
        settings.file_randomiser.allow_process_tracking = false;
    }

    Ok(settings)
}

/// Save updated settings to the persistent store
#[tauri::command]
pub fn set_app_settings(
    app: AppHandle<Wry>,
    #[allow(unused_mut)] mut settings: AppSettings, // It is not unused.
) -> Result<AppSettings, String> {
    // Force-disable process tracking on non-Windows
    #[cfg(not(target_os = "windows"))]
    {
        settings.file_randomiser.allow_process_tracking = false;
    }

    let store = app.store("store.json").map_err(|e| e.to_string())?;
    store.set("settings", serde_json::to_value(&settings).unwrap());
    store.save().map_err(|e| e.to_string())?;
    Ok(settings)
}

/// Toggle process tracking
#[tauri::command]
pub fn toggle_process_tracking(app: AppHandle<Wry>, enable: bool) -> Result<AppSettings, String> {
    let mut settings = get_app_settings(app.clone())?;

    #[cfg(target_os = "windows")]
    {
        settings.file_randomiser.allow_process_tracking = enable;
    }

    #[cfg(not(target_os = "windows"))]
    {
        settings.file_randomiser.allow_process_tracking = false;
    }

    set_app_settings(app, settings.clone())?;
    Ok(settings)
}

/// Set language
#[tauri::command]
pub fn set_language(app: AppHandle<Wry>, language: LanguageOption) -> Result<AppSettings, String> {
    let mut settings = get_app_settings(app.clone())?;
    settings.language = language;
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

/// Set custom background via file dialog (non-blocking, same fix as folder picker)
#[tauri::command]
pub async fn set_custom_background(app: AppHandle<Wry>) -> Result<AppSettings, String> {
    let app_for_dialog = app.clone();

    let picked = tauri::async_runtime::spawn_blocking(move || {
        app_for_dialog.dialog().file().blocking_pick_file()
    })
    .await
    .map_err(|e| e.to_string())?;

    let Some(file_path) = picked else {
        return Err("No file selected".into());
    };

    let path_buf: PathBuf = match file_path {
        FilePath::Path(p) => p,
        FilePath::Url(url) => url.to_file_path().map_err(|_| "URL not a file path")?,
    };

    let bytes = fs::read(&path_buf).map_err(|e| format!("Failed to read file: {}", e))?;
    let encoded = general_purpose::STANDARD.encode(&bytes);

    let ext = path_buf
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png");

    let data_url = format!("data:image/{};base64,{}", ext, encoded);

    let mut settings = get_app_settings(app.clone())?;
    settings.custom_background = Some(data_url);
    set_app_settings(app, settings.clone())?;

    Ok(settings)
}

/// Clear the custom background
#[tauri::command]
pub fn clear_custom_background(app: AppHandle<Wry>) -> Result<AppSettings, String> {
    let mut settings = get_app_settings(app.clone())?;
    settings.custom_background = None;
    set_app_settings(app, settings.clone())?;
    Ok(settings)
}

/// Set the randomness level for the file randomiser (0-100)
#[tauri::command]
pub fn set_randomness_level(app: AppHandle<Wry>, level: u8) -> Result<AppSettings, String> {
    if level > 100 {
        return Err("Randomness level must be between 0 and 100".into());
    }
    let mut settings = get_app_settings(app.clone())?;
    settings.file_randomiser.randomness_level = level;
    set_app_settings(app, settings.clone())?;
    Ok(settings)
}

#[tauri::command]
pub fn restart_app(app_handle: AppHandle) {
    app_handle.restart();
}

#[tauri::command]
pub fn get_global_bookmarks(app: AppHandle<Wry>) -> Result<Vec<Bookmark>, String> {
    let settings = get_app_settings(app)?;
    Ok(settings.file_randomiser.global_bookmarks)
}

#[tauri::command]
pub fn set_global_bookmarks(
    app: AppHandle<Wry>,
    bookmarks: Vec<Bookmark>,
) -> Result<Vec<Bookmark>, String> {
    let mut settings = get_app_settings(app.clone())?;
    settings.file_randomiser.global_bookmarks = bookmarks.clone();
    set_app_settings(app, settings)?;
    Ok(bookmarks)
}
