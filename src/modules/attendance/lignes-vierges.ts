/**
 * Le format de la feuille d'émargement vierge (21 novembre 2026).
 *
 * Module à part, et sans dépendance : ces trois nombres servent au rendu du
 * PDF, à la route d'export **et** au panneau d'export, qui est un composant
 * client. Les lire depuis `pdf.ts` aurait embarqué Puppeteer dans le bundle du
 * navigateur pour trois entiers.
 */

/**
 * Lignes par page A4, mesuré sur la mise en page de `pdf.ts` (en-tête compris,
 * réserve de pied de page déduite). Sert à proposer des comptes qui remplissent
 * des pages entières : une feuille dont la dernière page ne porte qu'une ligne
 * se jette, et on l'imprime quand même.
 *
 * Se tromper ne casse rien — une page presque vide de plus ou de moins.
 */
export const LIGNES_VIERGES_PAR_PAGE = 19;

/** Lignes vides par défaut : deux pages pleines. */
export const LIGNES_VIERGES_DEFAUT = 2 * LIGNES_VIERGES_PAR_PAGE;

/** Au-delà, ce n'est plus une feuille de secours mais une rame de papier. */
export const LIGNES_VIERGES_MAX = 300;
