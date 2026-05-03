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
    /// Empty by default — colours not in the table get weight 1.0
    pub colors: HashMap<String, ColorWeightEntry>,
}

impl Default for BookmarkPreference {
    fn default() -> Self {
        Self {
            enabled: false,
            colors: HashMap::new(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkColorOption {
    pub hex: String,
    pub label: String,
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
pub enum LanguageOption {
    En,
    Nl,
    Bs,
    De,
    Pl,
}

impl Default for LanguageOption {
    fn default() -> Self {
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

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct AppSettings {
    pub dark_mode: DarkModeOption,
    pub language: LanguageOption,
    pub custom_background: Option<String>,
    pub file_randomiser: FileRandomiserSettings,
    pub bookmark_colors: Vec<BookmarkColorOption>,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            dark_mode: Default::default(),
            language: Default::default(),
            custom_background: None,
            file_randomiser: Default::default(),
            bookmark_colors: vec![
                BookmarkColorOption {
                    hex: "#FF6B6B".to_string(),
                    label: "Red".to_string(),
                },
                BookmarkColorOption {
                    hex: "#6BCB77".to_string(),
                    label: "Green".to_string(),
                },
                BookmarkColorOption {
                    hex: "#FFD700".to_string(),
                    label: "Gold".to_string(),
                },
                BookmarkColorOption {
                    hex: "#4D96FF".to_string(),
                    label: "Blue".to_string(),
                },
                BookmarkColorOption {
                    hex: "#C77DFF".to_string(),
                    label: "Purple".to_string(),
                },
                BookmarkColorOption {
                    hex: "#FF922B".to_string(),
                    label: "Orange".to_string(),
                },
            ],
        }
    }
}
