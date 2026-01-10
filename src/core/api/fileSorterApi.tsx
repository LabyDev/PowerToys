import { invoke } from "@tauri-apps/api/core";
import { AppStateData } from "../../types/filerandomiser";

/**
 * Opens a native directory dialog and returns the selected path
 */
export const selectSortDirectory = () => {
  return invoke<string | null>("select_sort_directory");
};

/**
 * Triggers the sorting logic based on the current path, similarity, and filters
 */
export const sortFiles = (
  path: string,
  similarity: number,
  filters: AppStateData,
) => {
  return invoke<void>("sort_files", { path, similarity, filters });
};

/**
 * Reverts the last sorting operation (Undo)
 */
export const restoreLastSort = () => {
  return invoke<void>("restore_last_sort");
};

/**
 * Returns a preview of what the sort will do (for the "Processing Preview" section)
 */
export const getSortPreview = (
  path: string,
  similarity: number,
  filters: AppStateData,
) => {
  return invoke<string[]>("get_sort_preview", { path, similarity, filters });
};

/**
 * Checks if a restore point exists to enable/disable the undo button
 */
export const checkRestorePoint = () => {
  return invoke<boolean>("has_restore_point");
};
