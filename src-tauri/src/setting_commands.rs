use crate::context::windows_shell::is_context_menu_registered;
use crate::models::AppSettings;
use std::collections::HashMap;
use tauri::State;

// Command to get the current settings
#[tauri::command]
pub fn get_app_settings(state: State<AppSettings>) -> Result<HashMap<&'static str, bool>, String> {
    let enabled = is_context_menu_registered();
    let process_tracking_enabled = *state.allow_process_tracking.lock().unwrap();

    let mut settings = HashMap::new();
    settings.insert("enableContextMenu", enabled);
    settings.insert("allowProcessTracking", process_tracking_enabled);

    Ok(settings)
}
