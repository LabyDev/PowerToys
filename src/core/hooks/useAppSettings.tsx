import { useCallback, useEffect, useState } from "react";
import {
  getAppSettings,
  getGlobalBookmarks,
  setAppSettings,
  setGlobalBookmarks,
} from "../api/appSettingsApi";
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

  const [globalBookmarks, setGlobalBookmarksState] = useState<Bookmark[]>([]);

  // Fetch settings and bookmarks on mount
  useEffect(() => {
    getAppSettings().then(setSettingsState).catch(console.error);
    getGlobalBookmarks().then(setGlobalBookmarksState).catch(console.error);
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
      setAppSettings(newSettings).catch(console.error);
      return newSettings;
    });
  }, []);

  const fetchGlobalBookmarks = useCallback(async () => {
    try {
      const latest = await getGlobalBookmarks();
      setGlobalBookmarksState(latest);
      return latest;
    } catch (err) {
      console.error("Failed to fetch global bookmarks:", err);
      return [];
    }
  }, []);

  const setGlobalBookmarksSettings = useCallback(
    async (bookmarks: Bookmark[]) => {
      try {
        await setGlobalBookmarks(bookmarks);
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
    setGlobalBookmarks: setGlobalBookmarksSettings,
    fetchGlobalBookmarks,
  };
}
