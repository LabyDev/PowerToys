use crate::models::common::FilterRule;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SorterFileEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
}

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
    pub files: Vec<SorterFileEntry>,
    pub similarity_threshold: u8,
    pub filter_rules: Vec<FilterRule>,
    pub preview: Vec<SortOperation>,
    pub stats: SortStats,
    pub has_restore_point: bool,
}

impl Default for FileSorterState {
    fn default() -> Self {
        Self {
            current_path: None,
            files: vec![],
            similarity_threshold: 80,
            filter_rules: vec![],
            preview: vec![],
            stats: SortStats {
                files_to_move: 0,
                folders_to_create: 0,
            },
            has_restore_point: false,
        }
    }
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
    pub timestamp: String,
    pub original_path: String,
    pub moves: Vec<MoveRecord>,
}
