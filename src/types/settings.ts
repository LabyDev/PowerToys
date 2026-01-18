import { Bookmark } from "./common";

/** Language options */
export type LanguageOption = "en" | "nl" | "bs" | "de" | "pl";

/** Dark mode options */
export type DarkModeOption = "light" | "dark" | "system";

/** Application settings */
export type AppSettings = {
  language: LanguageOption;
  darkMode: DarkModeOption;
  customBackground?: string;

  fileRandomiser: {
    allow_process_tracking: boolean;
    randomness_level: number;
    global_bookmarks: Bookmark[];
  };
};
