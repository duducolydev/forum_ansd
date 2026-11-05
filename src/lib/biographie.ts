import { z } from "zod";

/**
 * Biographie d'une personne : limites, validation et extrait pour les cartes
 * (5 novembre 2026).
 *
 * Une seule règle pour tous les champs biographie — inscription, « Mon
 * espace », fiche participant du BackOffice, fiche intervenant (trois langues)
 * et import d'intervenants : la biographie du participant et celle de sa fiche
 * intervenant sont la même (`modules/speakers/biographie.ts`), une limite plus
 * basse d'un côté aurait refusé ce que l'autre avait accepté.
 *
 * Deux plafonds : 600 mots, qui est ce que le comité demande, et 5000
 * caractères, garde-fou contre un texte collé sans espaces.
 *
 * Sans dépendance serveur : le formulaire d'inscription valide ses étapes
 * dans le navigateur avec ces mêmes schémas.
 */

export const BIOGRAPHIE_MAX_MOTS = 600;
export const BIOGRAPHIE_MAX_CARACTERES = 5000;

/** Nombre de mots : suites de caractères séparées par des espaces. */
export function compterMots(texte: string): number {
  const nettoye = texte.trim();
  return nettoye ? nettoye.split(/\s+/).length : 0;
}

/** Champ biographie facultatif, avec les deux plafonds. Messages en français, traduits à l'affichage. */
export const schemaBiographie = z
  .string()
  .trim()
  .max(BIOGRAPHIE_MAX_CARACTERES, `${BIOGRAPHIE_MAX_CARACTERES} caractères maximum`)
  .refine(
    (texte) => compterMots(texte) <= BIOGRAPHIE_MAX_MOTS,
    `${BIOGRAPHIE_MAX_MOTS} mots maximum`,
  )
  .optional()
  .or(z.literal(""));

/**
 * Début d'une biographie pour une carte, coupé à la fin d'un mot.
 *
 * `tronquee` dit s'il y a une suite à proposer. Le texte n'est coupé que s'il
 * dépasse nettement la limite (d'un dixième) : retirer trois mots pour
 * afficher « Lire la suite » coûterait plus au lecteur qu'il n'y gagne.
 */
export function extraitBiographie(
  texte: string,
  limite: number,
): { extrait: string; tronquee: boolean } {
  const propre = texte.trim();
  if (propre.length <= limite * 1.1) return { extrait: propre, tronquee: false };

  const coupe = propre.slice(0, limite);
  const dernierEspace = coupe.search(/\s\S*$/);
  const base = dernierEspace > limite * 0.6 ? coupe.slice(0, dernierEspace) : coupe;
  return { extrait: `${base.replace(/[\s,;:.–—-]+$/, "")}…`, tronquee: true };
}
