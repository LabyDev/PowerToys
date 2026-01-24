import { invoke } from "@tauri-apps/api/core";
import { RandomiserPreset } from "../../types/filerandomiser";

export const getPresets = async (): Promise<RandomiserPreset[]> => {
  return invoke("get_presets");
};

export const savePreset = async (preset: RandomiserPreset) => {
  return invoke("save_preset", { preset });
};

export const openPresetsFolder = () => invoke("open_presets_folder");
