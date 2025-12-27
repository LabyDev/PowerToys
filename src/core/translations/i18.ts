import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import nl from "./locales/nl.json";
import de from "./locales/de.json";
import pl from "./locales/pl.json";

// Initialize i18next
i18n
  .use(initReactI18next) // Connects i18n with React
  .init({
    resources: {
      en: { translation: en },
      nl: { translation: nl },
      de: { translation: de },
      pl: { translation: pl },
    },
    lng: navigator.language.split("-")[0], // default language
    fallbackLng: "en", // fallback if translation is missing
    interpolation: {
      escapeValue: false, // react already safes from XSS
    },
  });

export default i18n;
