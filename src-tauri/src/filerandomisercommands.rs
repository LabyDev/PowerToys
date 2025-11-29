use crate::models::{AppStateData, SavedPath, FileEntry, HistoryEntry};

#[tauri::command]
pub fn get_initial_app_data() -> AppStateData {
    // In a real app, you would fetch this from a database or file system
    AppStateData {
        paths: vec![
            SavedPath { id: 1, name: "Documents".into(), path: "/home/user/documents".into() },
            SavedPath { id: 2, name: "Pictures".into(), path: "/home/user/pictures".into() },
        ],
        files: vec![
            FileEntry { id: 1, name: "image1.png".into(), path: "/home/user/pictures/image1.png".into() },
            FileEntry { id: 2, name: "report.pdf".into(), path: "/home/user/documents/report.pdf".into() },
        ],
        history: vec![
            HistoryEntry { id: 1, name: "old_file.txt".into(), path: "/home/user/documents/old_file.txt".into() },
        ],
    }
}