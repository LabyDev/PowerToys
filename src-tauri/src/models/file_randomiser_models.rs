use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::FilePath;

use crate::models::{FilterRule, SavedPath};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub id: u64,
    pub name: String,
    pub path: FilePath,
    pub excluded: bool,
    #[serde(default)]
    pub hash: Option<String>,
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
    pub pick_counts: HashMap<u64, u32>,
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
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub hash: String,
    pub path: FilePath, // absolute path (primary key)
    #[serde(default)]
    pub color: Option<String>,
}
