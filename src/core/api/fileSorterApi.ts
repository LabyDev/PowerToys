import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { FileSorterState } from "../../types/filesorter";

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
  filters: FileSorterState,
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
  filters: FileSorterState,
) => {
  return invoke<
    FileSorterState & {
      excludedPaths?: string[];
      forcedTargets?: Record<string, string>;
    }
  >("get_sort_preview", { path, similarity, filters });
};

/**
 * Checks if a restore point exists to enable/disable the undo button
 */
export const checkRestorePoint = () => {
  return invoke<boolean>("has_restore_point");
};

/**
 * Updates the similarity threshold in the backend
 */
export const setSimilarityThreshold = (threshold: number) => {
  return invoke<void>("set_similarity_threshold", { threshold });
};

/**
 * Emits a log message to the frontend console panel
 */
export const logFrontend = (message: string) => {
  return emit("file_sorter_log", `[ui] ${message}`);
};

/**
 * Exclude a file or folder from sorting
 */
export const excludePath = (path: string) => {
  return invoke<void>("exclude_path", { path });
};

/**
 * Include a previously excluded file or folder
 */
export const includePath = (path: string) => {
  return invoke<void>("include_path", { path });
};

/**
 * Force a specific target folder for a path
 */
export const forceTarget = (path: string) => {
  return invoke<void>("force_target", { path });
};

/**
 * Reveal a file or folder in the system file explorer
 */
export const revealInExplorer = (path: string) => {
  return invoke<void>("reveal_in_explorer", { path });
};
