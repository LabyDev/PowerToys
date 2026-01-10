use serde::{Deserialize, Serialize};
use tauri_plugin_dialog::FilePath;

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
