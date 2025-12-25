import { invoke } from "@tauri-apps/api/core";
import { RandomiserPreset } from "../../types/filerandomiser";

export const getPresets = async (): Promise<RandomiserPreset[]> => {
  return invoke("get_presets");
};

export const savePreset = async (preset: RandomiserPreset) => {
  return invoke("save_preset", { preset });
};

export const deletePreset = async (id: string) => {
  return invoke("delete_preset", { id });
};

export const importPresets = async () => {
  return invoke("import_presets_via_dialog");
};

export const exportPreset = async (id: string) => {
  return invoke("export_preset_via_dialog", { id });
};

export const openPresetsFolder = () => invoke("open_presets_folder");
