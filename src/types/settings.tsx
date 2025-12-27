export type DarkModeOption = "light" | "dark" | "system";

export type AppSettings = {
  darkMode: DarkModeOption;
  customBackground?: string;
  fileRandomiser: {
    allow_process_tracking: boolean;
    randomness_level: number;
  };
};
