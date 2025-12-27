export type LanguageOption = "en" | "nl" | "bs" | "de" | "pl";

export type DarkModeOption = "light" | "dark" | "system";

export type AppSettings = {
  language: LanguageOption;
  darkMode: DarkModeOption;
  customBackground?: string;
  fileRandomiser: {
    allow_process_tracking: boolean;
    randomness_level: number;
  };
};
