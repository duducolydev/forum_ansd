/**
 * Format du badge imprimé (22 novembre 2026) : **74 × 105 mm, portrait** — le
 * format A7, celui des pochettes porte-badge courantes.
 *
 * Il remplace le 100 × 150 mm du 25 octobre 2026. La maquette de
 * l'infographe, dessinée pour ce dernier, est conservée telle quelle et
 * réduite d'un seul facteur (`ECHELLE_MAQUETTE`) : les deux formats ont
 * presque les mêmes proportions (0,705 contre 0,667), si bien que rien ne se
 * déforme ni ne se recompose. La maquette réduite fait 70 × 105 mm ; les 2 mm
 * restants de chaque côté sont couverts par le fond, étiré à la carte entière.
 *
 * Le gabarit, le rendu PDF et la planche d'impression lisent tous ces valeurs :
 * un format écrit en trois endroits finit toujours par diverger, et c'est ainsi
 * que la planche imprimait en paysage un badge rendu en portrait.
 */
export const FORMAT_BADGE = {
  largeurMm: 74,
  hauteurMm: 105,
  /**
   * Largeur du PNG (aperçu, téléchargement, planche d'impression) : 740 px
   * pour 74 mm, soit 254 ppp, la résolution retenue pour le 100 × 150. La
   * capture PNG, faite une à une, est le goulot du rendu en lot ; à 1 200 px
   * pour 100 mm, les dégradés de la maquette faisaient passer 500 badges
   * au-delà des 5 minutes du brief (§5.4). Le PDF, lui, reste vectoriel.
   */
  largeurPng: 740,
} as const;

/**
 * Cotes de la maquette de l'infographe, en millimètres : le gabarit place tout
 * dans ce repère, puis le réduit à la hauteur du badge.
 */
export const MAQUETTE = { largeurMm: 100, hauteurMm: 150 } as const;

/** Réduction de la maquette : sa hauteur ramenée à celle du badge (0,7). */
export const ECHELLE_MAQUETTE = FORMAT_BADGE.hauteurMm / MAQUETTE.hauteurMm;

/**
 * Gabarit en vigueur : la maquette de l'infographe (26 octobre 2026).
 *
 * Il figure dans le nom des fichiers (`badges/<id>/v1-maquette-2026-d.pdf`) :
 * un badge rendu avec un gabarit antérieur — la carte CR80, puis le premier
 * 100 × 150 mm du 25 octobre — se reconnaît ainsi sans migration, et se refait
 * depuis l'écran Badges, même QR. Changer de gabarit, c'est changer ce repère.
 *
 * Révision « b » (29 octobre 2026) : même maquette, mais un intervenant sans
 * photo de participant prend celle de sa fiche d'intervenant. Les badges
 * rendus avant ne l'ont pas ; le repère changé les fait proposer à refaire.
 *
 * Révision « c » (2 novembre 2026) : la civilité abrégée (« Dr », « SE »…)
 * précède le prénom. Mêmes conséquences pour les badges rendus avant.
 *
 * Révision « d » (12 novembre 2026) : le bandeau du bas ne porte plus de
 * texte — ni le libellé de la catégorie, ni la mention (« ACCRÉDITATION
 * PRESSE »…) —, seulement le code couleur de la catégorie. Les badges déjà
 * rendus portent encore le libellé ; le repère changé les fait proposer à
 * refaire depuis l'écran Badges, même QR et sans e-mail.
 *
 * « a7-2026 » (22 novembre 2026) : passage au 74 × 105 mm. Tous les badges
 * rendus avant sont à refaire — participants depuis l'écran Badges, cartes
 * anonymes depuis leur stock —, même QR, sans e-mail.
 */
export const GABARIT_BADGE = "a7-2026";

/**
 * Fente pour cordon : oblongue, 15 × 3 mm, centrée — la perforation standard
 * des pinces et des emporte-pièces de badge, qui ne se réduit pas avec la
 * maquette. La maquette la dessinait plus large et à 2,6 mm du bord, où la
 * perforation risque de déchirer le badge.
 *
 * À 3,5 mm du bord haut depuis le 74 × 105 (5 mm auparavant) : le logo réduit
 * commence à 7 mm, et la fente doit s'arrêter avant lui.
 */
export const FENTE_CORDON = {
  largeurMm: 15,
  hauteurMm: 3,
  depuisLeHautMm: 3.5,
} as const;

/** Vrai si le fichier a été rendu avec le gabarit en vigueur. */
export function auGabaritCourant(chemin: string | null): boolean {
  return Boolean(chemin?.includes(`-${GABARIT_BADGE}.`));
}
