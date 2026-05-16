import { invoke } from "@tauri-apps/api/core";
import { AppStateData } from "../../types/filerandomiser";
import { Bookmark } from "../../types/common";

export const getAppState = () => invoke<AppStateData>("get_app_state");

export const updateAppState = (newData: AppStateData) =>
  invoke("update_app_state", { newData });

export const addPathViaDialog = () => invoke("add_path_via_dialog");

export const removePath = (id: number) =>
  invoke<boolean>("remove_path", { id });

export const crawlPaths = (
  globalBookmarks: Bookmark[],
  localBookmarks: Bookmark[],
) => invoke("crawl_paths", { globalBookmarks, localBookmarks });

export const openFileById = (id: number) => invoke("open_file_by_id", { id });

export const pickRandomFile = () => invoke("pick_random_file");

export const openPath = (path: string) => invoke("open_path", { path });

export const setPresetPathWeights = (weights: Record<string, number>) =>
  invoke("set_preset_path_weights", { weights });

export const updateFileBookmark = (
  hash: string,
  color: string | null,
  isGlobal: boolean,
) => invoke<void>("update_file_bookmark", { hash, color, isGlobal });

export const updateFileBookmarksBulk = (
  hashes: string[],
  color: string | null,
  isGlobal: boolean,
) => invoke<void>("update_file_bookmarks_bulk", { hashes, color, isGlobal });
