import { invoke } from "@tauri-apps/api/core";
import { AppSettings } from "../../types/settings";
import { Bookmark } from "../../types/common";

/**
 * Fetches the current application settings
 */
export const getAppSettings = () => {
  return invoke<AppSettings>("get_app_settings");
};

/**
 * Updates the application settings
 */
export const setAppSettings = (settings: AppSettings) => {
  return invoke<void>("set_app_settings", { settings });
};

/**
 * Fetches the global bookmarks
 */
export const getGlobalBookmarks = () => {
  return invoke<Bookmark[]>("get_global_bookmarks");
};

/**
 * Sets the global bookmarks and persists them
 */
export const setGlobalBookmarks = (bookmarks: Bookmark[]) => {
  return invoke<void>("set_global_bookmarks", { bookmarks });
};
