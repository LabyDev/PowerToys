use serde::{Deserialize, Serialize};

// File randomiser settings
#[derive(Serialize, Deserialize, Clone)]
pub struct FileRandomiserSettings {
    pub allow_process_tracking: bool,
    pub randomness_level: u8,
}

impl Default for FileRandomiserSettings {
    fn default() -> Self {
        FileRandomiserSettings {
            allow_process_tracking: false,
            randomness_level: 50,
        }
    }
}

// Dark mode options
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

// Language options
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum LanguageOption {
    En,
    Nl,
    De,
    Pl,
}

impl Default for LanguageOption {
    fn default() -> Self {
        // Try to get the system locale
        let locale = sys_locale::get_locale()
            .unwrap_or_else(|| "en".to_string())
            .to_lowercase();

        if locale.starts_with("nl") {
            LanguageOption::Nl
        } else if locale.starts_with("de") {
            LanguageOption::De
        } else if locale.starts_with("pl") {
            LanguageOption::Pl
        } else {
            LanguageOption::En
        }
    }
}

// Main app settings
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub dark_mode: DarkModeOption,
    pub language: LanguageOption,
    pub custom_background: Option<String>,
    pub file_randomiser: FileRandomiserSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            dark_mode: Default::default(),
            language: Default::default(),
            custom_background: None,
            file_randomiser: Default::default(),
        }
    }
}
