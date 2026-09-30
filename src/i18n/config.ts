export const locales = ["fr", "en", "pt"] as const;
export type Locale = (typeof locales)[number];

/** Français par défaut (brief D6, §10). */
export const defaultLocale: Locale = "fr";
