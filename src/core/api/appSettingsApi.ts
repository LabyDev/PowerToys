import { invoke } from "@tauri-apps/api/core";
import {
  AppSettings,
  DarkModeOption,
  FileAuditorKeybinds,
  LanguageOption,
} from "../../types/settings";
import { Bookmark } from "../../types/common";

export const getAppSettings = () => invoke<AppSettings>("get_app_settings");

export const setAppSettings = (settings: AppSettings) =>
  invoke<void>("set_app_settings", { settings });

export const getGlobalBookmarks = () =>
  invoke<Bookmark[]>("get_global_bookmarks");

export const setGlobalBookmarks = (bookmarks: Bookmark[]) =>
  invoke<void>("set_global_bookmarks", { bookmarks });

export const toggleProcessTracking = (enable: boolean) =>
  invoke<AppSettings>("toggle_process_tracking", { enable });

export const setRandomnessLevel = (level: number) =>
  invoke<AppSettings>("set_randomness_level", { level });

export const setDarkMode = (mode: DarkModeOption) =>
  invoke<AppSettings>("set_dark_mode", { mode });

export const setLanguage = (language: LanguageOption) =>
  invoke<AppSettings>("set_language", { language });

export const setCustomBackground = () =>
  invoke<AppSettings>("set_custom_background");

export const clearCustomBackground = () =>
  invoke<AppSettings>("clear_custom_background");

export const setFileAuditorKeybinds = (keybinds: FileAuditorKeybinds) =>
  invoke<AppSettings>("set_file_auditor_keybinds", { keybinds });

export const openSettingsFolder = () => invoke<void>("open_settings_folder");

export const restartApp = () => invoke<void>("restart_app");
