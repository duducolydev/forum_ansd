/**
 * Préférences d'affichage du menu du BackOffice.
 *
 * Le cookie est **écrit par le navigateur** et **lu par le serveur** (voir
 * `sidebar-serveur.ts`), pour que le premier rendu soit déjà dans le bon état :
 * un menu replié qui s'afficherait déplié une fraction de seconde ferait sauter
 * la mise en page à chaque navigation.
 *
 * Pourquoi pas une Server Action, comme pour le thème : elle laisse une fenêtre
 * pendant laquelle l'état local est à jour mais le cookie ne l'est pas encore.
 * Replier le menu puis cliquer aussitôt sur un lien rouvrait alors le menu —
 * défaut constaté en test de bout en bout. Une écriture synchrone dans
 * `document.cookie` supprime la course et évite un aller-retour pour une simple
 * préférence d'affichage. Rien de sensible ici : le serveur ne fait que la lire.
 */
export const COOKIE_MENU = "forum-sidebar";
export const COOKIE_MENU_MAX_AGE = 60 * 60 * 24 * 365;

export interface EtatMenu {
  /** Menu réduit à ses icônes. */
  replie: boolean;
  /** Libellés des rubriques repliées. Absentes = dépliées. */
  fermees: string[];
}

export const ETAT_MENU_PAR_DEFAUT: EtatMenu = { replie: false, fermees: [] };

/** Analyse la valeur du cookie, avec repli sur le menu déplié. */
export function lireEtatMenu(brut: string | undefined): EtatMenu {
  if (!brut) return ETAT_MENU_PAR_DEFAUT;

  try {
    const analyse = JSON.parse(decodeURIComponent(brut)) as Partial<EtatMenu>;
    return {
      replie: analyse.replie === true,
      fermees: Array.isArray(analyse.fermees)
        ? analyse.fermees.filter((entree): entree is string => typeof entree === "string")
        : [],
    };
  } catch {
    // Cookie tronqué ou d'une version antérieure : on repart du menu déplié
    // plutôt que de propager une erreur jusqu'au gabarit.
    return ETAT_MENU_PAR_DEFAUT;
  }
}

/** Écrit la préférence depuis le navigateur, sans aller-retour serveur. */
export function ecrireEtatMenu(etat: EtatMenu): void {
  if (typeof document === "undefined") return;
  const valeur = encodeURIComponent(JSON.stringify(etat));
  document.cookie = `${COOKIE_MENU}=${valeur}; path=/; max-age=${COOKIE_MENU_MAX_AGE}; samesite=lax`;
}
