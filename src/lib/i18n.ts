import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en";
import es from "@/locales/es";
import fr from "@/locales/fr";
import pt from "@/locales/pt";

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
};

const initialLanguage =
  typeof navigator !== "undefined" ? normalizeLanguage(navigator.language) : "en";

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export function normalizeLanguage(locale: string | null | undefined) {
  const value = (locale ?? "").toLowerCase();
  if (value.startsWith("en")) {
    return "en";
  }
  if (value.startsWith("fr")) {
    return "fr";
  }
  if (value.startsWith("pt")) {
    return "pt";
  }
  return "es";
}

export default i18n;
