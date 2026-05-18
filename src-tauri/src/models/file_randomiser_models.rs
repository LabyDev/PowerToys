use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::FilePath;

use crate::models::{Bookmark, SavedPath};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub id: u64,
    pub name: String,
    pub path: FilePath,
    pub excluded: bool,

    #[serde(default)]
    pub hash: Option<String>,

    #[serde(default)]
    pub bookmark: Option<BookmarkInfo>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileScore {
    pub id: u64,
    pub name: String,
    pub is_excluded: bool,
    pub order_score: f64,
    pub memory_factor: f64,
    pub bookmark_factor: f64,
    pub total_weight: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: u64,
    pub name: String,
    pub path: FilePath,
    pub opened_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppStateData {
    pub paths: Vec<SavedPath>,
    pub files: Vec<FileEntry>,
    pub history: Vec<HistoryEntry>,
    pub tracking_enabled: bool,
    pub filter_rules: Vec<FilterRule>,
    pub last_picked_id: Option<u64>,
    pub last_picked_index: Option<usize>,
    pub pick_counts: HashMap<u64, u32>,
    pub recency_list: Vec<u64>,
    #[serde(default)]
    pub preset_path_weights: HashMap<String, f64>,
}

impl Default for AppStateData {
    fn default() -> Self {
        Self {
            paths: vec![],
            files: vec![],
            history: vec![],
            tracking_enabled: false,
            filter_rules: vec![],
            last_picked_id: None,
            last_picked_index: None,
            pick_counts: HashMap::new(),
            recency_list: vec![],
            preset_path_weights: HashMap::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RandomiserPreset {
    pub id: String,
    pub name: String,
    pub paths: Vec<SavedPath>,
    pub filter_rules: Vec<FilterRule>,
    pub shuffle: Option<bool>,
    #[serde(default)]
    pub bookmarks: Vec<Bookmark>,
    #[serde(default)]
    pub path_weights: HashMap<String, f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum FilterAction {
    Include,
    Exclude,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum FilterMatchType {
    Contains,
    StartsWith,
    EndsWith,
    Regex,
    Bookmarks,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilterRule {
    pub id: String,
    pub action: FilterAction,
    #[serde(rename = "type")]
    pub match_type: FilterMatchType,
    pub pattern: String,
    #[serde(default)]
    pub case_sensitive: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkInfo {
    pub color: Option<String>,
    pub is_global: bool,
}

pub struct DebugFlags {
    pub randomiser: bool,
    pub log_file: Option<std::sync::Mutex<std::fs::File>>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct PersistedStats {
    pub history: Vec<HistoryEntry>,
    pub path_pick_counts: HashMap<String, u32>,
}
