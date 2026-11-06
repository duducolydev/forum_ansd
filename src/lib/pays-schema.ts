import { z } from "zod";
import { estPaysDeReference, normaliserPays } from "./pays";

/**
 * Règles de validation du pays (6 novembre 2026), sur la liste de `pays.ts`.
 *
 * Toute saisie reconnue est ramenée au nom de référence (« senegal », « SN »
 * → « Sénégal ») avant d'être enregistrée ; c'est ce qui empêche les doublons
 * de revenir après l'harmonisation.
 */

/** Pays obligatoire, normalisé. Une valeur inconnue est gardée (BackOffice, import, comptoir). */
export const schemaPaysObligatoire = z
  .string()
  .trim()
  .min(1, "Le pays est requis")
  .max(100)
  .transform(normaliserPays);

/** Pays facultatif, normalisé quand il est renseigné. */
export const schemaPaysFacultatif = z
  .string()
  .trim()
  .max(100)
  .transform((valeur) => (valeur ? normaliserPays(valeur) : valeur))
  .optional();

/**
 * Pays obligatoire **et pris dans la liste** : formulaires publics, où le
 * visiteur choisit dans la liste et n'a aucune raison d'envoyer autre chose.
 */
export const schemaPaysDeLaListe = schemaPaysObligatoire.refine(
  estPaysDeReference,
  "Choisissez un pays dans la liste",
);
