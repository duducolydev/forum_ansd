"use server";

import { cookies, headers } from "next/headers";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * i18n sans préfixe d'URL (brief §3.2 : aucune route ne montre de segment
 * `[locale]`) : la langue est détenue par un cookie, initialisée depuis
 * `Accept-Language` à la première visite — cf. brief §10.
 */
const COOKIE_NAME = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function getUserLocale(): Promise<Locale> {
  const cookieLocale = (await cookies()).get(COOKIE_NAME)?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }

  const acceptLanguage = (await headers()).get("accept-language");
  if (acceptLanguage?.toLowerCase().startsWith("en")) {
    return "en";
  }

  return defaultLocale;
}

export async function setUserLocale(locale: Locale): Promise<void> {
  (await cookies()).set(COOKIE_NAME, locale, { path: "/", maxAge: COOKIE_MAX_AGE });
}
