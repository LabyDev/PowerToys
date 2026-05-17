use crate::models::common::hash_from_meta;
use chrono::DateTime;
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

pub struct TrackedProcessMap(pub Mutex<HashMap<String, usize>>);

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
pub fn open_audit_file(app: tauri::AppHandle, path: String, track: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    if track {
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::{CloseHandle, HANDLE};
        use windows::Win32::System::Threading::{WaitForSingleObject, INFINITE};
        use windows::Win32::UI::Shell::{
            SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW, ShellExecuteExW,
        };

        let file_wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let mut sei: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
        sei.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        sei.fMask = SEE_MASK_NOCLOSEPROCESS;
        sei.lpFile = PCWSTR(file_wide.as_ptr());
        sei.nShow = 1; // SW_SHOWNORMAL

        let launched = unsafe {
            ShellExecuteExW(&mut sei).is_ok() && !sei.hProcess.0.is_null()
        };

        if launched {
            let handle_raw = sei.hProcess.0 as usize;
            let map = app.state::<TrackedProcessMap>();
            map.0.lock().unwrap().insert(path.clone(), handle_raw);

            let app_clone = app.clone();
            let path_clone = path.clone();
            std::thread::spawn(move || {
                let raw_ptr = handle_raw as *mut std::ffi::c_void;
                unsafe {
                    WaitForSingleObject(HANDLE(raw_ptr), INFINITE);
                    let _ = CloseHandle(HANDLE(raw_ptr));
                }
                // Clean up map entry if the viewer was closed naturally by the user
                let map = app_clone.state::<TrackedProcessMap>();
                map.0.lock().unwrap().remove(&path_clone);
            });
            return Ok(());
        }
        // Fall through to non-tracked open if ShellExecuteEx didn't give a handle
        // (e.g. file opened in an existing app instance)
    }

    app.opener()
        .open_path(&path, None::<String>)
        .map_err(|e| e.to_string())
}

/// Remove a path from the tracking map without killing the process.
/// Used when stopping the audit — viewer stays open.
#[tauri::command]
pub fn forget_tracked_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let map = app.state::<TrackedProcessMap>();
    map.0.lock().unwrap().remove(&path);
    Ok(())
}

/// Remove from map and kill the viewer process.
/// Used when navigating — close current file before opening the next.
#[tauri::command]
pub fn close_tracked_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let map = app.state::<TrackedProcessMap>();
    let handle_raw = map.0.lock().unwrap().remove(&path);
    #[cfg(target_os = "windows")]
    if let Some(raw) = handle_raw {
        use windows::Win32::Foundation::HANDLE;
        use windows::Win32::System::Threading::TerminateProcess;
        let raw_ptr = raw as *mut std::ffi::c_void;
        unsafe {
            let _ = TerminateProcess(HANDLE(raw_ptr), 1);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_to_trash(app: tauri::AppHandle, path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let map = app.state::<TrackedProcessMap>();
        let handle_raw = map.0.lock().unwrap().remove(&path);
        if let Some(raw) = handle_raw {
            use windows::Win32::Foundation::HANDLE;
            use windows::Win32::System::Threading::TerminateProcess;
            let raw_ptr = raw as *mut std::ffi::c_void;
            unsafe {
                let _ = TerminateProcess(HANDLE(raw_ptr), 1);
            }
            // Wait for file locks to be released after process termination
            std::thread::sleep(std::time::Duration::from_millis(300));
        }
    }
    trash::delete(&path).map_err(|e| e.to_string())
}
