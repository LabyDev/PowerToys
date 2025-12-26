import { useEffect } from "react";
import { useAppSettings } from "../hooks/useAppSettings";

function BackgroundManager() {
  const { settings, isDarkMode } = useAppSettings();

  useEffect(() => {
    // Set the background image on body
    if (settings.customBackground) {
      document.body.style.backgroundImage = `url(${settings.customBackground})`;
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundRepeat = "no-repeat";
    } else {
      document.body.style.backgroundImage = "none";
    }

    return () => {
      document.body.style.backgroundImage = "";
      document.body.style.backgroundSize = "";
      document.body.style.backgroundPosition = "";
      document.body.style.backgroundRepeat = "";
    };
  }, [settings.customBackground, isDarkMode]);

  return null;
}

export default BackgroundManager;
