import { EDGE_TTS_VOICES, type EdgeTTSVoice } from "./edge-tts";

export type VoiceGroup<T> = [string, T[]];

const LOCALE_LABEL_OVERRIDES: Record<string, string> = {
  und: "Unknown language",
  "zh-CN": "Chinese (Simplified, China)",
  "zh-HK": "Chinese (Traditional, Hong Kong)",
  "zh-TW": "Chinese (Traditional, Taiwan)",
  "en-AU": "English (Australia)",
  "en-CA": "English (Canada)",
  "en-GB": "English (United Kingdom)",
  "en-IN": "English (India)",
  "en-US": "English (United States)",
};

function normalizeLocaleCode(locale: string): string {
  const trimmed = locale.trim().replace(/_/g, "-");
  if (!trimmed) return "und";
  const [language, ...rest] = trimmed.split("-");
  if (!rest.length) return language.toLowerCase();
  return [
    language.toLowerCase(),
    ...rest.map((part) =>
      part.length === 4
        ? `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`
        : part.toUpperCase(),
    ),
  ].join("-");
}

function compareVoiceLanguage(a: string, b: string) {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const aEn = aLower.startsWith("en") ? -1 : 0;
  const bEn = bLower.startsWith("en") ? -1 : 0;
  return aEn - bEn || a.localeCompare(b);
}

function resolveDisplayLocale(displayLocale?: string): string {
  if (displayLocale?.trim()) return normalizeLocaleCode(displayLocale);
  try {
    const runtimeLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (runtimeLocale) return normalizeLocaleCode(runtimeLocale);
  } catch {
    // Fall through to English.
  }
  return "en";
}

export function getLocaleDisplayLabel(locale: string, displayLocale?: string): string {
  const normalizedLocale = normalizeLocaleCode(locale || "und");
  const override = LOCALE_LABEL_OVERRIDES[normalizedLocale];

  if (override) {
    return override;
  }

  const resolvedDisplayLocale = resolveDisplayLocale(displayLocale);

  try {
    const [language, maybeScriptOrRegion, maybeRegion] = normalizedLocale.split("-");
    const languageNames = new Intl.DisplayNames([resolvedDisplayLocale, "en"], {
      type: "language",
    });
    const regionNames = new Intl.DisplayNames([resolvedDisplayLocale, "en"], {
      type: "region",
    });
    const scriptNames = new Intl.DisplayNames([resolvedDisplayLocale, "en"], {
      type: "script",
    });

    const languageLabel = languageNames.of(language);
    const extras: string[] = [];

    if (maybeScriptOrRegion) {
      if (maybeScriptOrRegion.length === 4) {
        const scriptLabel = scriptNames.of(maybeScriptOrRegion);
        if (scriptLabel) extras.push(scriptLabel);
        if (maybeRegion) {
          const regionLabel = regionNames.of(maybeRegion);
          if (regionLabel) extras.push(regionLabel);
        }
      } else {
        const regionLabel = regionNames.of(maybeScriptOrRegion);
        if (regionLabel) extras.push(regionLabel);
      }
    }

    if (languageLabel && extras.length > 0) {
      return `${languageLabel} (${extras.join(", ")})`;
    }
    if (languageLabel) {
      return languageLabel;
    }
  } catch {
    // Fall back to the normalized locale code below.
  }

  return normalizedLocale;
}

export function groupEdgeTTSVoices(
  voices: EdgeTTSVoice[] = EDGE_TTS_VOICES,
): VoiceGroup<EdgeTTSVoice>[] {
  const grouped = new Map<string, EdgeTTSVoice[]>();
  for (const voice of voices) {
    const bucket = grouped.get(voice.lang) || [];
    bucket.push(voice);
    grouped.set(voice.lang, bucket);
  }
  return Array.from(grouped.entries())
    .sort(([a], [b]) => compareVoiceLanguage(a, b))
    .map(
      ([lang, items]) =>
        [lang, [...items].sort((a, b) => a.name.localeCompare(b.name))] as VoiceGroup<EdgeTTSVoice>,
    );
}

export { compareVoiceLanguage };
