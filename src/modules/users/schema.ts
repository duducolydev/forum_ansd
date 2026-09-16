import { z } from "zod";

/**
 * Comptes BackOffice (brief §5.14).
 *
 * La longueur minimale de 12 caractères vient du §7. Elle n'était jusqu'ici
 * appliquée nulle part faute d'écran pour l'exercer (réserve posée en 0.3) :
 * c'est ici qu'elle prend effet, à la création comme à la réinitialisation.
 */
export const LONGUEUR_MDP_MIN = 12;

const motDePasse = z
  .string()
  .min(LONGUEUR_MDP_MIN, `Le mot de passe doit faire au moins ${LONGUEUR_MDP_MIN} caractères.`)
  .max(200);

export const creationUtilisateurSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse électronique invalide.").max(190),
  name: z.string().trim().min(2, "Le nom est requis.").max(120),
  roleId: z.string().min(1, "Le rôle est requis."),
  password: motDePasse,
});

export const modificationUtilisateurSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis.").max(120),
  roleId: z.string().min(1, "Le rôle est requis."),
  isActive: z.boolean(),
});

export const reinitialisationMdpSchema = z.object({
  password: motDePasse,
});

export type CreationUtilisateur = z.infer<typeof creationUtilisateurSchema>;
export type ModificationUtilisateur = z.infer<typeof modificationUtilisateurSchema>;
