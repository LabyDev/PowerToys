// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Force a valid UTF-8 locale for JS Intl APIs
    // Safe on all platforms
    #[cfg(target_family = "unix")]
    {
        // On Linux/macOS
        std::env::set_var("LANG", "en_US.UTF-8");
        std::env::set_var("LC_ALL", "en_US.UTF-8");
    }
    powertoys_lib::run()
}
