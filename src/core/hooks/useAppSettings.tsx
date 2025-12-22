import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings } from "../../types/settings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    enable_context_menu: false,
    allow_process_tracking: false,
  });

  // Fetch settings on mount
  useEffect(() => {
    invoke<AppSettings>("get_app_settings")
      .then(setSettings)
      .catch((err) => console.error("Failed to fetch settings:", err));
  }, []);

  // Function to update settings persistently
  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      try {
        const newSettings = { ...settings, ...partial };
        const updated = await invoke<AppSettings>(
          "set_app_settings",
          newSettings,
        );
        setSettings(updated);
      } catch (err) {
        console.error("Failed to update settings:", err);
      }
    },
    [settings],
  );

  return { settings, setSettings: updateSettings };
}
