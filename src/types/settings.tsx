export type DarkModeOption = "light" | "dark" | "system";

export type AppSettings = {
  dark_mode: DarkModeOption;
  custom_background?: string;
  fileRandomiser: {
    enable_context_menu: boolean;
    allow_process_tracking: boolean;
  };
};
