import { cookies } from "next/headers";
import { lireEtatMenu, COOKIE_MENU, type EtatMenu } from "./sidebar";

/**
 * Lecture serveur de la préférence de menu.
 *
 * Fichier séparé de `sidebar.ts` parce que `next/headers` n'existe que côté
 * serveur : l'importer depuis le composant client de la barre latérale casserait
 * la compilation.
 */
export async function getEtatMenu(): Promise<EtatMenu> {
  return lireEtatMenu((await cookies()).get(COOKIE_MENU)?.value);
}
