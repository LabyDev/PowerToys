import { Bookmark } from "./common";

/** Language options */
export type LanguageOption = "en" | "nl" | "bs" | "de" | "pl";

/** Dark mode options */
export type DarkModeOption = "light" | "dark" | "system";

/** Application settings */
export type ColorWeightEntry = {
  local: number;
  global: number;
};

export type BookmarkPreference = {
  enabled: boolean;
  colors: Record<string, ColorWeightEntry>;
};

export type AppSettings = {
  language: LanguageOption;
  darkMode: DarkModeOption;
  customBackground?: string;
  fileRandomiser: {
    allowProcessTracking: boolean;
    randomnessLevel: number;
    globalBookmarks: Bookmark[];
    bookmarkPreference: BookmarkPreference;
    showScores: boolean;
  };
};
