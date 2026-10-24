import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// English is the only supported UI language.
import en_common from "./locales/en/common.json";
import en_library from "./locales/en/library.json";
import en_reader from "./locales/en/reader.json";
import en_chat from "./locales/en/chat.json";
import en_notes from "./locales/en/notes.json";
import en_settings from "./locales/en/settings.json";
import en_translation from "./locales/en/translation.json";
import en_tts from "./locales/en/tts.json";
import en_stats from "./locales/en/stats.json";
import en_onboarding from "./locales/en/onboarding.json";
import en_profile from "./locales/en/profile.json";
import en_misc from "./locales/en/misc.json";

const en = { ...en_common, ...en_library, ...en_reader, ...en_chat, ...en_notes, ...en_settings, ...en_translation, ...en_tts, ...en_stats, ...en_onboarding, ...en_profile, ...en_misc };

// Initialize with "en". Each platform should call
// `initI18nLanguage()` after setPlatformService() to restore the saved lang.
export const i18nReady = i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
  });

/**
 * Restore saved language from platform KV storage.
 * Call this once at app startup AFTER `setPlatformService()`.
 * English is the only supported language, so this only ever resolves to "en";
 * it remains async for API compatibility with existing callers.
 */
export async function initI18nLanguage(): Promise<void> {
  if (i18n.language !== "en") {
    try {
      await i18n.changeLanguage("en");
    } catch {
      i18n.language = "en";
    }
  }
}

/**
 * Change language and persist the choice to platform KV storage.
 * Only "en" has resources; any other value falls back to English.
 */
export async function changeAndPersistLanguage(_lang: string): Promise<void> {
  try {
    await i18n.changeLanguage("en");
  } catch {
    i18n.language = "en";
  }

  try {
    const { getPlatformService } = await import("../services/platform");
    const platform = getPlatformService();
    await platform.kvSetItem("readany-lang", "en");
  } catch {
    // Failed to persist — non-critical
  }
}

export default i18n;
