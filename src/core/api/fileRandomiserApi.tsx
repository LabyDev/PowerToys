import { invoke } from "@tauri-apps/api/core";
import { AppStateData, Bookmark } from "../../types/filerandomiser";

export const getAppState = () => {
  return invoke<AppStateData>("get_app_state");
};

export const updateAppState = (newData: AppStateData) => {
  return invoke("update_app_state", { newData });
};

export const addPathViaDialog = () => {
  return invoke("add_path_via_dialog");
};

export const removePath = (id: string) => {
  return invoke<boolean>("remove_path", { id });
};

export const crawlPaths = (
  globalBookmarks: Bookmark[],
  localBookmarks: Bookmark[],
) => {
  return invoke("crawl_paths", {
    globalBookmarks,
    localBookmarks,
  });
};

export const openFileById = (id: number) => {
  return invoke("open_file_by_id", { id });
};

export const pickRandomFile = () => {
  return invoke("pick_random_file");
};

export const openPath = (path: string) => {
  return invoke("open_path", { path });
};
