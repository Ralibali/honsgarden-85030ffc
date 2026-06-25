import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { defaultLanguageForRegion } from "@/lib/brand";

import sv_common from "./locales/sv/common.json";
import sv_auth from "./locales/sv/auth.json";
import sv_nav from "./locales/sv/nav.json";
import sv_settings from "./locales/sv/settings.json";
import sv_errors from "./locales/sv/errors.json";
import sv_premium from "./locales/sv/premium.json";

import en_common from "./locales/en/common.json";
import en_auth from "./locales/en/auth.json";
import en_nav from "./locales/en/nav.json";
import en_settings from "./locales/en/settings.json";
import en_errors from "./locales/en/errors.json";
import en_premium from "./locales/en/premium.json";

/**
 * Språk som har en KOMPLETT bundle och därför får vara aktiva i UI.
 * Lägg INTE till ett språk här förrän alla kärnflöden är översatta –
 * vi får inte sätta ett ofärdigt språk som aktivt.
 */
export const ENABLED_LANGUAGES = ["sv", "en"] as const;
export type EnabledLanguage = typeof ENABLED_LANGUAGES[number];

export function isEnabledLanguage(lng: string | null | undefined): lng is EnabledLanguage {
  return !!lng && (ENABLED_LANGUAGES as readonly string[]).includes(lng);
}

const resources = {
  sv: {
    common: sv_common,
    auth: sv_auth,
    nav: sv_nav,
    settings: sv_settings,
    errors: sv_errors,
    premium: sv_premium,
  },
  en: {
    common: en_common,
    auth: en_auth,
    nav: en_nav,
    settings: en_settings,
    errors: en_errors,
    premium: en_premium,
  },
};

const domainDefault = defaultLanguageForRegion();

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: domainDefault, // sv på honsgarden.se, en på honsgarden.app
    supportedLngs: [...ENABLED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    ns: ["common", "auth", "nav", "settings", "errors", "premium"],
    defaultNS: "common",
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      lookupLocalStorage: "honsgarden.lang",
      caches: ["localStorage"],
    },
  });

/**
 * Sätter aktivt språk men VAKTAR att vi aldrig växlar till ett språk
 * vars bundle saknas (skulle ge ett halvengelskt/halv-svenskt UI).
 */
export function setLanguageSafe(lng: string | null | undefined): void {
  const target = isEnabledLanguage(lng) ? lng : domainDefault;
  if (i18n.language !== target) {
    void i18n.changeLanguage(target);
  }
  try {
    localStorage.setItem("honsgarden.lang", target);
  } catch { /* ignore */ }
}

export default i18n;
