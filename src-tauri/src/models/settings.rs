use serde::{Deserialize, Serialize};

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub enable_context_menu: bool,
    pub allow_process_tracking: bool,
}
