/**
 * Format du badge imprimé (25 octobre 2026) : **100 × 150 mm, portrait**.
 *
 * C'est le grand format des forums institutionnels, demandé par l'infographe à
 * la place de la carte CR80 (54 × 86 mm) : il laisse au nom et au QR la place
 * d'être lus de loin, et ménage en tête la fente du cordon.
 *
 * Le gabarit, le rendu PDF et la planche d'impression lisent tous ces valeurs :
 * un format écrit en trois endroits finit toujours par diverger, et c'est ainsi
 * que la planche imprimait en paysage un badge rendu en portrait.
 */
export const FORMAT_BADGE = {
  largeurMm: 100,
  hauteurMm: 150,
  /**
   * Repère du format dans le nom des fichiers (`badges/<id>/v1-100x150.pdf`).
   * Un badge rendu à un autre format se reconnaît ainsi sans migration, et se
   * remet au format courant depuis l'écran Badges.
   */
  code: "100x150",
} as const;

/**
 * Fente pour cordon : oblongue, 15 × 3 mm, centrée, à 5 mm du bord haut — la
 * perforation standard des pinces et des emporte-pièces de badge. Le gabarit
 * en trace le repère et n'imprime rien d'autre dans sa zone.
 */
export const FENTE_CORDON = {
  largeurMm: 15,
  hauteurMm: 3,
  depuisLeHautMm: 5,
} as const;

/** Vrai si le fichier a été rendu au format courant. */
export function auFormatCourant(chemin: string | null): boolean {
  return Boolean(chemin?.includes(`-${FORMAT_BADGE.code}.`));
}
