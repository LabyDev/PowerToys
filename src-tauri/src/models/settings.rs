use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct FileRandomiserSettings {
    pub enable_context_menu: bool,
    pub allow_process_tracking: bool,
    pub randomness_level: u8,
}

impl Default for FileRandomiserSettings {
    fn default() -> Self {
        FileRandomiserSettings {
            enable_context_menu: false,
            allow_process_tracking: false,
            randomness_level: 50,
        }
    }
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

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub dark_mode: DarkModeOption,
    pub custom_background: Option<String>,
    pub file_randomiser: FileRandomiserSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            dark_mode: Default::default(),
            custom_background: None,
            file_randomiser: Default::default(),
        }
    }
}
