use crate::models::common::hash_from_meta;
use chrono::DateTime;
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuditFileEntry {
    pub id: u64,
    pub name: String,
    pub path: String,
    pub hash: String,
    pub size: u64,
    pub modified_at: Option<String>,
}

#[tauri::command]
pub async fn pick_audit_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = tauri::async_runtime::spawn_blocking(move || {
        app.dialog().file().blocking_pick_folder()
    })
    .await
    .map_err(|e| e.to_string())?;

    Ok(folder.and_then(|f| f.as_path().map(|p| p.to_string_lossy().to_string())))
}

#[tauri::command]
pub async fn audit_list_files(path: String) -> Result<Vec<AuditFileEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut results = Vec::new();
        let walker = WalkBuilder::new(&path)
            .hidden(false)
            .follow_links(false)
            .build();

        for (id, entry) in walker.flatten().enumerate() {
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if !meta.is_file() {
                continue;
            }
            let path_str = entry.path().to_string_lossy().to_string();
            let name = entry
                .path()
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let hash_str = format!("{:x}", hash_from_meta(&meta));
            let modified_at = meta.modified().ok().map(|t| {
                let dt: DateTime<chrono::Utc> = t.into();
                dt.to_rfc3339()
            });

            results.push(AuditFileEntry {
                id: id as u64,
                name,
                path: path_str,
                hash: hash_str,
                size: meta.len(),
                modified_at,
            });
        }

        results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
        results
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_audit_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.opener()
        .open_path(&path, None::<String>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_to_trash(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| e.to_string())
}
