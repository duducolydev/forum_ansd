"use server";

import { cookies } from "next/headers";

export type Theme = "light" | "dark";

/**
 * Cookie serveur pour éviter le flash au premier rendu (brief §9 bis). Si
 * aucun cookie n'est présent (première visite), on ne force volontairement
 * aucun `data-theme` : `globals.css` bascule alors sur `prefers-color-scheme`.
 */
const COOKIE_NAME = "forum-theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function getServerTheme(): Promise<Theme | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value === "dark" || value === "light" ? value : null;
}

export async function setServerTheme(theme: Theme): Promise<void> {
  (await cookies()).set(COOKIE_NAME, theme, { path: "/", maxAge: COOKIE_MAX_AGE });
}
