"use server";

import { cookies, headers } from "next/headers";
import { parametresPourGabarit } from "@/modules/settings/service";
import { defaultLocale, locales, type Locale } from "./config";

/**
 * i18n sans préfixe d'URL (brief §3.2 : aucune route ne montre de segment
 * `[locale]`) : la langue est détenue par un cookie, initialisée depuis
 * `Accept-Language` à la première visite — cf. brief §10.
 *
 * Le portugais (30 septembre 2026) ne vaut que s'il est activé dans les
 * paramètres : désactivé, un visiteur qui l'avait choisi — ou dont le
 * navigateur le demande — reçoit l'anglais, sa langue de repli.
 */
const COOKIE_NAME = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Langues proposées aux visiteurs, selon les paramètres de l'édition. */
export async function languesProposees(): Promise<Locale[]> {
  const { langues } = await parametresPourGabarit();
  return locales.filter((locale) => locale !== "pt" || langues.portugais);
}

export async function getUserLocale(): Promise<Locale> {
  const proposees = await languesProposees();
  const cookieLocale = (await cookies()).get(COOKIE_NAME)?.value;
  if (cookieLocale && locales.includes(cookieLocale as Locale)) {
    return proposees.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : "en";
  }

  // Première langue du navigateur que le site propose.
  const acceptLanguage = (await headers()).get("accept-language") ?? "";
  for (const preference of acceptLanguage.toLowerCase().split(",")) {
    const code = preference.trim().slice(0, 2);
    if (code === "fr") return "fr";
    if (code === "en") return "en";
    if (code === "pt") return proposees.includes("pt") ? "pt" : "en";
  }

  return defaultLocale;
}

export async function setUserLocale(locale: Locale): Promise<void> {
  (await cookies()).set(COOKIE_NAME, locale, { path: "/", maxAge: COOKIE_MAX_AGE });
}
