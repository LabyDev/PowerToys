import { invoke } from "@tauri-apps/api/core";
import { RandomiserPreset } from "../../types/filerandomiser";

export const getPresets = async (): Promise<RandomiserPreset[]> =>
  invoke("get_presets");

export const savePreset = async (preset: RandomiserPreset) =>
  invoke("save_preset", { preset });

export const openPresetsFolder = (): Promise<void> =>
  invoke("open_presets_folder");
