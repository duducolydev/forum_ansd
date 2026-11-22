/**
 * Filtre de l'écran Badges, tel qu'il voyage dans l'URL (brief §5.4).
 *
 * Module pur, sans accès à la base : l'écran (composant client), la planche
 * d'impression, la route d'export ZIP et les actions de lot le lisent tous
 * ici. Jusqu'au 22 novembre 2026, chacun recopiait sa propre lecture, et la
 * planche avait oublié le filtre d'export : elle imprimait tout le périmètre
 * là où l'écran n'en montrait qu'une partie.
 */

export interface FiltreBadges {
  categoryId?: string;
  delegationId?: string;
  /** `SANS` : pas encore de badge ; `AVEC` : badge valide ; `REVOQUE` : à réémettre. */
  etat?: "SANS" | "AVEC" | "REVOQUE";
  /**
   * `JAMAIS` : badge encore jamais emporté par un export ZIP ; `DEJA` : au
   * moins une fois. C'est ce qui permet de ne confier à l'imprimeur que le
   * complément d'un envoi précédent (19 novembre 2026).
   */
  export?: "JAMAIS" | "DEJA";
  /**
   * Jour du **dernier** export, `AAAA-MM-JJ` (22 novembre 2026) : retrouver
   * un lot précis pour le réimprimer. Plus précis que `DEJA`, qu'il remplace
   * quand les deux sont posés.
   */
  exporteLe?: string;
}

/** `AAAA-MM-JJ` d'une vraie date du calendrier, ou `undefined`. */
export function jourValide(valeur: string | null | undefined): string | undefined {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return undefined;
  const jour = new Date(`${valeur}T00:00:00.000Z`);
  // « 2026-02-31 » passe l'expression mais devient le 3 mars : on l'écarte.
  return !Number.isNaN(jour.getTime()) && jour.toISOString().slice(0, 10) === valeur
    ? valeur
    : undefined;
}

/**
 * Lit le filtre depuis des paramètres d'URL. Une valeur inconnue est écartée
 * plutôt que renvoyée en erreur : un lien abîmé montre le périmètre entier,
 * pas une page d'erreur.
 */
export function lireFiltreBadges(lire: (cle: string) => string | null | undefined): FiltreBadges {
  const etat = lire("etat");
  const exporte = lire("export");
  const exporteLe = jourValide(lire("exporteLe"));
  return {
    categoryId: lire("categoryId") || undefined,
    delegationId: lire("delegationId") || undefined,
    etat: etat === "SANS" || etat === "AVEC" || etat === "REVOQUE" ? etat : undefined,
    // Un jour d'export désigne des badges exportés : « jamais exportés » le
    // contredirait, « déjà exportés » ne dirait rien de plus.
    export: exporteLe
      ? undefined
      : exporte === "JAMAIS" || exporte === "DEJA"
        ? exporte
        : undefined,
    exporteLe,
  };
}

/** Bornes UTC du jour — l'heure de Dakar toute l'année. */
export function bornesDuJour(jour: string): { gte: Date; lt: Date } {
  const debut = new Date(`${jour}T00:00:00.000Z`);
  return { gte: debut, lt: new Date(debut.getTime() + 24 * 60 * 60 * 1000) };
}
