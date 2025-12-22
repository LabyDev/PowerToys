import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings } from "../../types/settings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    enableContextMenu: false,
    allowProcessTracking: false,
  });

  useEffect(() => {
    invoke<AppSettings>("get_app_settings")
      .then(setSettings)
      .catch((err) => console.error("Failed to fetch settings:", err));
  }, []);

  return { settings, setSettings };
}
