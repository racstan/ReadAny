/**
 * Custom font types for user-uploaded fonts
 */

export type FontFormat = "ttf" | "otf" | "woff" | "woff2";

export type FontSource = "local" | "remote";

export interface CustomFont {
  id: string;
  name: string;
  fileName: string;
  filePath?: string;
  fontFamily: string;
  format: FontFormat;
  size?: number;
  addedAt: number;
  source: FontSource;
  remoteUrl?: string;
  remoteUrlWoff2?: string;
  /** CSS stylesheet URL (e.g. webfont CDN CSS). When set, the CSS is imported directly
   *  instead of generating an @font-face rule. fontFamily must match the CSS's font-family. */
  remoteCssUrl?: string;
}

export interface FontPreset {
  id: string;
  name: string;
  nameEn: string;
  fontFamily: string;
  isCustom?: boolean;
}

export const SYSTEM_FONTS: FontPreset[] = [
  { id: "system", name: "System Default", nameEn: "System Default", fontFamily: "system-ui" },
  { id: "serif", name: "Serif", nameEn: "Serif", fontFamily: "Georgia, serif" },
  { id: "sans", name: "Sans-serif", nameEn: "Sans-serif", fontFamily: "Arial, sans-serif" },
  { id: "mono", name: "Monospace", nameEn: "Monospace", fontFamily: "Menlo, monospace" },
];

/** Built-in preset fonts users can add with one click */
export interface PresetFontDef {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  fontFamily: string;
  /** CSS stylesheet URL for CDN webfonts (preferred) */
  remoteCssUrl?: string;
  /** Direct woff2 URL fallback */
  remoteUrlWoff2?: string;
  remoteUrl?: string;
  format: FontFormat;
  license: string;
}

export const PRESET_FONTS: PresetFontDef[] = [
  {
    id: "preset-literata",
    name: "Literata",
    nameEn: "Literata",
    description: "Designed for long-form reading, used by Google Play Books",
    descriptionEn: "Designed for long-form reading, used by Google Play Books",
    fontFamily: "Literata",
    remoteCssUrl: "https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;0,700;1,400&display=swap",
    format: "woff2",
    license: "OFL-1.1",
  },
  {
    id: "preset-merriweather",
    name: "Merriweather",
    nameEn: "Merriweather",
    description: "A medium-contrast serif typeface designed to be readable on screens",
    descriptionEn: "A medium-contrast serif typeface designed to be readable on screens",
    fontFamily: "Merriweather",
    remoteCssUrl: "https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap",
    format: "woff2",
    license: "OFL-1.1",
  },
  {
    id: "preset-inter",
    name: "Inter",
    nameEn: "Inter",
    description: "A clean, modern geometric sans-serif designed for digital screens",
    descriptionEn: "A clean, modern geometric sans-serif designed for digital screens",
    fontFamily: "Inter",
    remoteCssUrl: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap",
    format: "woff2",
    license: "OFL-1.1",
  },
  {
    id: "preset-roboto-serif",
    name: "Roboto Serif",
    nameEn: "Roboto Serif",
    description: "An elegant serif companion to Roboto, crafted for comfortable reading",
    descriptionEn: "An elegant serif companion to Roboto, crafted for comfortable reading",
    fontFamily: "Roboto Serif",
    remoteCssUrl: "https://fonts.googleapis.com/css2?family=Roboto+Serif:ital,opsz,wght@0,8..144,400;0,8..144,700;1,8..144,400&display=swap",
    format: "woff2",
    license: "OFL-1.1",
  },
];
