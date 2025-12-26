export type DarkModeOption = "light" | "dark" | "system";

export type AppSettings = {
  darkMode: DarkModeOption;
  customBackground?: string;
  fileRandomiser: {
    enable_context_menu: boolean;
    allow_process_tracking: boolean;
  };
};
