use std::sync::Mutex;

#[derive(Default)]

pub struct AppSettings {
    pub enable_context_menu: Mutex<bool>,
    pub allow_process_tracking: Mutex<bool>,
}
