use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::FilePath;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedPath {
    pub id: u64,
    pub name: String,
    pub path: FilePath,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileEntryBase {
    pub id: u64,
    pub name: String,
    pub path: FilePath,
    pub is_dir: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Bookmark {
    pub hash: String,
    pub path: FilePath, // absolute path (primary key)
    #[serde(default)]
    pub color: Option<String>,
}
