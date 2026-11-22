/**
 * Le format de la feuille d'émargement vierge (21 novembre 2026).
 *
 * Module à part, et sans dépendance : ces nombres servent au rendu du PDF, à la
 * route d'export **et** au panneau d'export, qui est un composant client. Les
 * lire depuis `pdf.ts` aurait embarqué Puppeteer dans le bundle du navigateur
 * pour trois entiers.
 */

/**
 * Lignes tenant sur la **première** page, celle qui porte l'en-tête du
 * document.
 */
export const LIGNES_PREMIERE_PAGE = 20;

/**
 * Lignes tenant sur les **pages suivantes**, qui ne reprennent que l'en-tête du
 * tableau.
 *
 * Deux nombres et non un : une liasse de 152 lignes demandée comme « huit
 * pages » en a rendu neuf, dont la dernière portait une ligne unique. Compter
 * les pages suivantes comme la première sous-estime la liasse d'environ 10 %,
 * et l'écart ne se voit qu'à l'impression.
 *
 * Les deux sont **mesurés** sur la mise en page de `pdf.ts` — en rendant de
 * vraies feuilles et en comptant les pages obtenues. Se tromper ne casse rien :
 * une page presque vide de plus ou de moins.
 *
 * Remesurés le 22 novembre 2026, quand le pied de page est passé dans la marge
 * d'impression : les douze millimètres qu'on lui réservait au bas du tableau
 * sont revenus aux lignes, et les pages suivantes en portent une de plus. La
 * première n'a pas bougé — le logo du Forum, ajouté le même jour, tient dans
 * la hauteur du bloc de titre.
 */
export const LIGNES_PAGES_SUIVANTES = 23;

/** Lignes à demander pour obtenir `pages` pages pleines. */
export function lignesPourPages(pages: number): number {
  return LIGNES_PREMIERE_PAGE + Math.max(0, pages - 1) * LIGNES_PAGES_SUIVANTES;
}

/** Deux pages pleines. */
export const LIGNES_VIERGES_DEFAUT = lignesPourPages(2);

/** Au-delà, ce n'est plus une feuille de secours mais une rame de papier. */
export const LIGNES_VIERGES_MAX = 300;
