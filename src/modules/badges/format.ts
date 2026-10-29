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
   * Largeur du PNG (aperçu, téléchargement, planche d'impression) : 1 000 px
   * pour 100 mm, soit 254 ppp. La capture PNG, faite une à une, est le goulot
   * du rendu en lot ; à 1 200 px, les dégradés de la maquette faisaient passer
   * 500 badges au-delà des 5 minutes du brief (§5.4). Le PDF, lui, reste
   * vectoriel.
   */
  largeurPng: 1000,
} as const;

/**
 * Gabarit en vigueur : la maquette de l'infographe (26 octobre 2026).
 *
 * Il figure dans le nom des fichiers (`badges/<id>/v1-maquette-2026-b.pdf`) :
 * un badge rendu avec un gabarit antérieur — la carte CR80, puis le premier
 * 100 × 150 mm du 25 octobre — se reconnaît ainsi sans migration, et se refait
 * depuis l'écran Badges, même QR. Changer de gabarit, c'est changer ce repère.
 *
 * Révision « b » (29 octobre 2026) : même maquette, mais un intervenant sans
 * photo de participant prend celle de sa fiche d'intervenant. Les badges
 * rendus avant ne l'ont pas ; le repère changé les fait proposer à refaire.
 */
export const GABARIT_BADGE = "maquette-2026-b";

/**
 * Fente pour cordon : oblongue, 15 × 3 mm, centrée, à 5 mm du bord haut — la
 * perforation standard des pinces et des emporte-pièces de badge. La maquette
 * la dessinait plus large et à 2,6 mm du bord, où la perforation risque de
 * déchirer le badge : le repère garde ces cotes, dans le gris de la maquette.
 */
export const FENTE_CORDON = {
  largeurMm: 15,
  hauteurMm: 3,
  depuisLeHautMm: 5,
} as const;

/** Vrai si le fichier a été rendu avec le gabarit en vigueur. */
export function auGabaritCourant(chemin: string | null): boolean {
  return Boolean(chemin?.includes(`-${GABARIT_BADGE}.`));
}
