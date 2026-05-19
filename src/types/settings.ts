import { Bookmark, BookmarkColorOption } from "./common";

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

export type FileAuditorKeybinds = {
  prev: string;
  next: string;
  delete: string;
  bookmarks: string[];
  clearBookmark: string;
  stop: string;
  closeViewer: string;
};

export type FileAuditorSettings = {
  allowProcessTracking?: boolean;
  globalCloseViewerShortcut?: boolean;
  keybinds: FileAuditorKeybinds;
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
    pathWeights?: Record<string, number>;
    pathWeightsEnabled?: boolean;
    historyRetentionDays: number;
  };
  fileAuditor?: FileAuditorSettings;
  bookmarkColors: BookmarkColorOption[];
};
