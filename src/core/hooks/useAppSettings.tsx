import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { AppSettings, LanguageOption } from "../../types/settings";
import { Bookmark } from "../../types/common";

export function useAppSettings() {
  const [settings, setSettingsState] = useState<AppSettings>({
    language: navigator.language.split("-")[0] as LanguageOption,
    darkMode: "system",
    customBackground: undefined,
    fileRandomiser: {
      allow_process_tracking: false,
      randomness_level: 50,
      global_bookmarks: [],
    },
  });

  const [globalBookmarks, setGlobalBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    // Fetch app settings
    invoke<AppSettings>("get_app_settings")
      .then(setSettingsState)
      .catch(console.error);

    // Fetch global bookmarks
    invoke<Bookmark[]>("get_global_bookmarks")
      .then(setGlobalBookmarks)
      .catch(console.error);
  }, []);

  const setSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const newSettings: AppSettings = {
        ...prev,
        ...partial,
        fileRandomiser: {
          ...prev.fileRandomiser,
          ...partial.fileRandomiser,
        },
      };
      invoke("set_app_settings", { settings: newSettings }).catch(
        console.error,
      );
      return newSettings;
    });
  }, []);

  const fetchGlobalBookmarks = useCallback(async () => {
    try {
      const latest = await invoke<Bookmark[]>("get_global_bookmarks");
      setGlobalBookmarks(latest);
      return latest;
    } catch (err) {
      console.error("Failed to fetch global bookmarks:", err);
      return [];
    }
  }, []);

  const setGlobalBookmarksPersist = useCallback(
    async (bookmarks: Bookmark[]) => {
      try {
        await invoke("set_global_bookmarks", { bookmarks });
        // Always fetch latest after saving
        return fetchGlobalBookmarks();
      } catch (err) {
        console.error("Failed to set global bookmarks:", err);
        return [];
      }
    },
    [fetchGlobalBookmarks],
  );

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
    settings.darkMode === "system" ? systemDark : settings.darkMode === "dark";

  return {
    settings,
    setSettings,
    isDarkMode,
    globalBookmarks,
    setGlobalBookmarks: setGlobalBookmarksPersist,
    fetchGlobalBookmarks,
  };
}
