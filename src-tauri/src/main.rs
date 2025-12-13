// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if std::env::args().any(|arg| arg == "--toggle-context-menu") {
        #[cfg(windows)]
        {
            // run the registry function directly
            let _ = powertoys_lib::context::toggle_context_menu_item();
        }

        return; // exit immediately, no GUI
    }

    powertoys_lib::run()
}
