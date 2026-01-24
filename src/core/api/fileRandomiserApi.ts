import { invoke } from "@tauri-apps/api/core";
import { AppStateData } from "../../types/filerandomiser";
import { Bookmark } from "../../types/common";

/**
 * Retrieves the current file randomiser application state
 */
export const getAppState = () => {
  return invoke<AppStateData>("get_app_state");
};

/**
 * Updates the file randomiser state with new data
 */
export const updateAppState = (newData: AppStateData) => {
  return invoke("update_app_state", { newData });
};

/**
 * Opens a native dialog to add a new path to the randomiser
 */
export const addPathViaDialog = () => {
  return invoke("add_path_via_dialog");
};

/**
 * Removes a path by its ID
 * @param id The unique identifier of the path to remove
 * @returns boolean indicating success
 */
export const removePath = (id: string) => {
  return invoke<boolean>("remove_path", { id });
};

/**
 * Crawls the given global and local bookmarks for files
 * @param globalBookmarks List of global bookmarks
 * @param localBookmarks List of local bookmarks
 */
export const crawlPaths = (
  globalBookmarks: Bookmark[],
  localBookmarks: Bookmark[],
) => {
  return invoke("crawl_paths", {
    globalBookmarks,
    localBookmarks,
  });
};

/**
 * Opens a file by its unique ID
 * @param id The ID of the file to open
 */
export const openFileById = (id: number) => {
  return invoke("open_file_by_id", { id });
};

/**
 * Picks a random file from the current state
 */
export const pickRandomFile = () => {
  return invoke("pick_random_file");
};

/**
 * Opens a folder or path in the system file explorer
 * @param path The path to open
 */
export const openPath = (path: string) => {
  return invoke("open_path", { path });
};
