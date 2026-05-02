use crate::models::Bookmark;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorWeightEntry {
    pub local: f64,
    pub global: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct BookmarkPreference {
    pub enabled: bool,
    /// Keys are lowercase hex strings e.g. "#ff6b6b"
    pub colors: HashMap<String, ColorWeightEntry>,
}

impl Default for BookmarkPreference {
    fn default() -> Self {
        let mut colors = HashMap::new();
        colors.insert(
            "#ff6b6b".to_string(),
            ColorWeightEntry {
                local: 2.5,
                global: 2.0,
            },
        );
        colors.insert(
            "#6bcb77".to_string(),
            ColorWeightEntry {
                local: 1.8,
                global: 1.5,
            },
        );
        colors.insert(
            "#ffd700".to_string(),
            ColorWeightEntry {
                local: 1.4,
                global: 1.2,
            },
        );
        colors.insert(
            "#4d96ff".to_string(),
            ColorWeightEntry {
                local: 1.1,
                global: 1.0,
            },
        );
        Self {
            enabled: false,
            colors,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct FileRandomiserSettings {
    pub allow_process_tracking: bool,
    pub randomness_level: u8,
    pub global_bookmarks: Vec<Bookmark>,
    pub bookmark_preference: BookmarkPreference,
    pub show_scores: bool,
}

impl Default for FileRandomiserSettings {
    fn default() -> Self {
        FileRandomiserSettings {
            allow_process_tracking: false,
            randomness_level: 50,
            global_bookmarks: vec![],
            bookmark_preference: BookmarkPreference::default(),
            show_scores: false,
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
    Bs,
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
        } else if locale.starts_with("bs") {
            LanguageOption::Bs
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
#[serde(rename_all = "camelCase", default)]
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
