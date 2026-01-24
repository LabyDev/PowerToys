import { invoke } from "@tauri-apps/api/core";
import { RandomiserPreset } from "../../types/filerandomiser";

/**
 * Retrieves all saved file randomiser presets
 * @returns Array of RandomiserPreset objects
 */
export const getPresets = async (): Promise<RandomiserPreset[]> => {
  return invoke("get_presets");
};

/**
 * Saves a new or updated randomiser preset
 * @param preset The preset to save
 */
export const savePreset = async (preset: RandomiserPreset) => {
  return invoke("save_preset", { preset });
};

/**
 * Opens the system folder where presets are stored
 */
export const openPresetsFolder = () => invoke("open_presets_folder");
