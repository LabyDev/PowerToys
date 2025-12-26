import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings } from "../../types/settings";

export type DarkModeOption = true | false | "system";

export function useAppSettings() {
  const [settings, setSettingsState] = useState<AppSettings>({
    dark_mode: "system",
    custom_background: undefined,
    fileRandomiser: {
      enable_context_menu: false,
      allow_process_tracking: false,
    },
  });

  // Fetch settings on mount
  useEffect(() => {
    invoke<AppSettings>("get_app_settings")
      .then(setSettingsState)
      .catch((err) => console.error("Failed to fetch settings:", err));
  }, []);

  // Function to update settings persistently
  const setSettings = useCallback(async (partial: Partial<AppSettings>) => {
    try {
      setSettingsState((prevSettings) => {
        const newSettings: AppSettings = {
          ...prevSettings,
          ...partial,
          fileRandomiser: {
            ...prevSettings.fileRandomiser,
            ...(partial.fileRandomiser || {}),
          },
        };

        // Persist the new settings
        invoke("set_app_settings", { settings: newSettings }).catch((err) =>
          console.error("Failed to persist settings:", err),
        );

        return newSettings;
      });
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  }, []);

  // Computed actual dark mode based on system preference
  const [systemDark, setSystemDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const isDarkMode =
    settings.dark_mode === "system" ? systemDark : settings.dark_mode;

  return { settings, setSettings, isDarkMode };
}
