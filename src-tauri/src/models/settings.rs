use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct FileRandomiserSettings {
    pub enable_context_menu: bool,
    pub allow_process_tracking: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum DarkModeOption {
    Light,
    Dark,
    System,
}

impl Default for DarkModeOption {
    fn default() -> Self {
        DarkModeOption::System
    }
}

#[derive(Default, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub dark_mode: DarkModeOption,
    pub custom_background: Option<String>,
    pub file_randomiser: FileRandomiserSettings,
}
