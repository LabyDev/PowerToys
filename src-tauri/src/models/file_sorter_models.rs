use std::collections::{HashMap, HashSet};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SorterFileEntry {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SortOperation {
    pub file_name: String,
    pub source_path: String,
    pub destination_folder: String,
    pub reason: String,
    pub is_new_folder: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SortStats {
    pub files_to_move: usize,
    pub folders_to_create: usize,
    pub total_size_to_move: u64,
    pub total_folders_affected: usize,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileSorterState {
    pub current_path: Option<String>,
    pub files: Vec<SorterFileEntry>,
    pub similarity_threshold: u8,
    pub preview: Vec<SortOperation>,
    pub stats: SortStats,
    pub has_restore_point: bool,
    pub excluded_paths: HashSet<String>,
    pub forced_targets: HashMap<String, String>,
}

impl Default for FileSorterState {
    fn default() -> Self {
        Self {
            current_path: None,
            files: vec![],
            similarity_threshold: 80,
            preview: vec![],
            stats: SortStats {
                files_to_move: 0,
                folders_to_create: 0,
                total_size_to_move: 0,
                total_folders_affected: 0,
            },
            has_restore_point: false,
            excluded_paths: HashSet::new(),
            forced_targets: HashMap::new(),
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
