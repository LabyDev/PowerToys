use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::FilePath;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")] // Ensures Rust snake_case becomes JS camelCase
pub struct SavedPath {
    pub id: u64,
    pub name: String,
    pub path: FilePath,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub id: u64,
    pub name: String,
    pub path: FilePath,
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
pub struct FolderExclusion {
    pub id: String,
    pub path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FilenameExclusion {
    pub id: String,
    pub pattern: String,
    pub is_regex: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppStateData {
    pub paths: Vec<SavedPath>,
    pub files: Vec<FileEntry>,
    pub history: Vec<HistoryEntry>,
    pub tracking_enabled: bool,
    pub excluded_folders: Vec<FolderExclusion>,
    pub excluded_filenames: Vec<FilenameExclusion>,
}
