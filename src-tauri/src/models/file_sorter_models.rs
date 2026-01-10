use crate::models::common::FilterRule;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SortOperation {
    pub file_name: String,
    pub source_path: String,
    pub destination_folder: String,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SortStats {
    pub files_to_move: usize,
    pub folders_to_create: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileSorterState {
    pub current_path: Option<String>,
    pub similarity_threshold: u8,
    pub filter_rules: Vec<FilterRule>,
    pub preview: Vec<SortOperation>,
    pub stats: SortStats,
    pub has_restore_point: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MoveRecord {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SortHistoryRecord {
    pub timestamp: String, // Or use chrono::DateTime<Utc>
    pub original_path: String,
    pub moves: Vec<MoveRecord>,
}
