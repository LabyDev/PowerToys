use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use std::sync::Mutex;
use tauri::{Manager, State};

#[derive(Default)]
pub struct AppState {
    pub enable_context_menu: Mutex<bool>,
}

// Placeholder for file opening logic
fn open_random_file_logic() {
    println!("Executing: Open a random file!");
}

// Command to get the current settings
#[tauri::command]
pub fn get_app_settings(
    state: State<AppState>,
) -> Result<std::collections::HashMap<&'static str, bool>, String> {
    let enabled = *state.enable_context_menu.lock().unwrap();
    let mut settings = std::collections::HashMap::new();
    settings.insert("enableContextMenu", enabled);
    Ok(settings)
}

// --- Context Menu Logic for Windows (using the 'windows' crate) ---
#[cfg(windows)]
mod windows_shell {
    use super::*;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::GetLastError;
    use windows::Win32::System::Registry::{
        RegCreateKeyExW, RegDeleteTreeW, RegOpenKeyExW, RegSetValueExW, HKEY, HKEY_CURRENT_USER,
        KEY_SET_VALUE, KEY_WRITE, REG_CREATE_KEY_DISPOSITION, REG_OPEN_CREATE_OPTIONS, REG_SZ,
    };

    const KEY_NAME: &str = "FileRandomiser";
    const PARENT_KEY_PATH: &str = r"Software\Classes\Directory\Background\shell";

    fn to_wide(s: &str) -> Vec<u16> {
        std::ffi::OsStr::new(s)
            .encode_wide()
            .chain(Some(0))
            .collect()
    }

    pub fn register_context_menu_item() -> Result<(), String> {
        let full_key_path = format!(r"{}\{}", PARENT_KEY_PATH, KEY_NAME);
        let command_key_path = format!(r"{}\{}\command", PARENT_KEY_PATH, KEY_NAME);

        // --- 1. Create or open the main key ---
        let mut main_handle = HKEY::default();
        let mut disposition = REG_CREATE_KEY_DISPOSITION(0);

        let res = unsafe {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(to_wide(&full_key_path).as_ptr()),
                None,
                PCWSTR::null(),
                REG_OPEN_CREATE_OPTIONS(0),
                KEY_WRITE,
                None,
                &mut main_handle,
                Some(&mut disposition),
            )
        };

        if res.is_err() {
            return Err(format!("Failed to create/open main key: {}", unsafe {
                GetLastError().0
            }));
        }

        // --- 2. Set the display name ---
        let display_name = "Open Random File (via FileRandomiser)";
        set_reg_value(main_handle, display_name)?;

        unsafe { windows::Win32::System::Registry::RegCloseKey(main_handle) };

        // --- 3. Create or open the command subkey ---
        let mut cmd_handle = HKEY::default();
        let res = unsafe {
            RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(to_wide(&command_key_path).as_ptr()),
                None,
                PCWSTR::null(),
                REG_OPEN_CREATE_OPTIONS(0),
                KEY_WRITE,
                None,
                &mut cmd_handle,
                Some(&mut disposition),
            )
        };

        if res.is_err() {
            return Err(format!(
                "Failed to create/open command subkey: {}",
                unsafe { GetLastError().0 }
            ));
        }

        // --- 4. Set the command value ---
        let exe_path =
            std::env::current_exe().map_err(|e| format!("Failed to get exe path: {}", e))?;
        let command = format!(r#""{}" "%1""#, exe_path.display());
        set_reg_value(cmd_handle, &command)?;

        unsafe { windows::Win32::System::Registry::RegCloseKey(cmd_handle) };

        println!("Context menu registered successfully.");
        Ok(())
    }

    fn set_reg_value(key: HKEY, value: &str) -> Result<(), String> {
        let wide: Vec<u16> = std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(Some(0))
            .collect();
        let data_ptr = wide.as_ptr() as *const u8;
        let data_len = wide.len() * std::mem::size_of::<u16>();
        let res = unsafe {
            RegSetValueExW(
                key,
                 PCWSTR::null(), // default value
                Some(0),
                REG_SZ,
                Some(std::slice::from_raw_parts(data_ptr, data_len)),
            )
        };

        if res.is_err() {
            return Err(format!("Failed to set registry value: {}", unsafe {
                GetLastError().0
            }));
        }

        Ok(())
    }

    pub fn unregister_context_menu_item() -> Result<(), String> {
        let full_key_path = format!(r"{}\{}", PARENT_KEY_PATH, KEY_NAME);
        let wide_path = to_wide(&full_key_path);

        let res = unsafe { RegDeleteTreeW(HKEY_CURRENT_USER, PCWSTR(wide_path.as_ptr())) };

        if res.is_ok() {
            println!("Context menu unregistered successfully.");
            Ok(())
        } else {
            let err = unsafe { GetLastError().0 };
            if err == 2 {
                println!("Key was already removed.");
                Ok(())
            } else {
                Err(format!("Failed to delete registry key: {}", err))
            }
        }
    }
}

// --- Context Menu Logic for Other Platforms (Placeholder) ---
#[cfg(not(windows))]
// ... (The non-windows_shell module remains the same) ...
mod non_windows_shell {
    pub fn register_context_menu_item() -> Result<(), String> {
        Err("Context menu integration not implemented for this OS.".to_string())
    }
    pub fn unregister_context_menu_item() -> Result<(), String> {
        Err("Context menu integration not implemented for this OS.".to_string())
    }
}

// --- The Main Tauri Command ---
#[tauri::command]
pub fn toggle_context_menu_item(state: State<AppState>, enable: bool) -> Result<(), String> {
    let mut enabled_lock = state.enable_context_menu.lock().unwrap();
    *enabled_lock = enable;

    // Use the appropriate module based on the compilation target
    #[cfg(windows)]
    {
        if enable {
            windows_shell::register_context_menu_item()?;
        } else {
            windows_shell::unregister_context_menu_item()?;
        }
    }

    #[cfg(not(windows))]
    {
        if enable {
            non_windows_shell::register_context_menu_item()?;
        } else {
            non_windows_shell::unregister_context_menu_item()?;
        }
    }

    Ok(())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    // Check for the custom context menu argument to execute logic and exit
    if args.contains(&String::from("--random-file-action")) {
        println!("App launched from context menu. Opening random file...");
        open_random_file_logic();
        return;
    }

    // Normal app launch
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... your existing commands ...
            get_app_settings,
            toggle_context_menu_item
        ])
        .setup(|app| {
            app.manage(AppState::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
