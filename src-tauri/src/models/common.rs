use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::FilePath;

pub fn hash_from_meta(meta: &std::fs::Metadata) -> u64 {
    let modified = meta
        .modified()
        .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut hasher = DefaultHasher::new();
    meta.len().hash(&mut hasher);
    modified.hash(&mut hasher);
    hasher.finish()
}

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
