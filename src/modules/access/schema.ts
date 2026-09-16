import { z } from "zod";

/**
 * Zones d'accès, points de contrôle et matrice (brief §2.6, §15).
 *
 * Le code de zone est en majuscules et sans espace : il voyage dans le
 * manifeste hors ligne du scanner et sert de clé de comparaison dans
 * `decision.ts`. Un code saisi tantôt « VIP » tantôt « vip » produirait un refus
 * incompréhensible au point de contrôle.
 */
export const zoneInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Le code est requis")
    .max(30)
    .regex(/^[A-Z0-9_]+$/, "Majuscules, chiffres et tirets bas uniquement"),
  name: z.string().trim().min(2, "Le nom est requis").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ZoneInput = z.infer<typeof zoneInputSchema>;

export const checkpointInputSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis").max(100),
  zoneId: z.string().min(1, "La zone est requise"),
  deviceLabel: z.string().trim().max(60).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type CheckpointInput = z.infer<typeof checkpointInputSchema>;

export const matrixCellSchema = z.object({
  categoryId: z.string().min(1),
  zoneId: z.string().min(1),
  allowed: z.boolean(),
});

export type MatrixCell = z.infer<typeof matrixCellSchema>;

/**
 * Exception individuelle : un motif est **exigé**, pas facultatif comme en base.
 * Un accès VIP accordé sans raison écrite est indéfendable trois semaines plus
 * tard ; la colonne reste nullable pour les reprises de données, le formulaire
 * ne le permet pas.
 */
export const overrideInputSchema = z.object({
  participantPublicId: z.string().trim().min(3, "L'identifiant participant est requis").max(40),
  zoneId: z.string().min(1, "La zone est requise"),
  reason: z.string().trim().min(5, "Le motif est requis").max(300),
});

export type OverrideInput = z.infer<typeof overrideInputSchema>;
