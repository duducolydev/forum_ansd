import { z } from "zod";

/** Édition d'un modèle en BackOffice (brief §5.13). La clé et le canal ne sont pas modifiables. */
export const templateSchema = z.object({
  subjectFr: z.string().trim().max(300).optional().or(z.literal("")),
  subjectEn: z.string().trim().max(300).optional().or(z.literal("")),
  bodyFr: z.string().trim().min(1, "Le corps en français est requis").max(20000),
  bodyEn: z.string().trim().min(1, "Le corps en anglais est requis").max(20000),
  subjectPt: z.string().trim().max(300).optional().or(z.literal("")),
  bodyPt: z.string().trim().max(20000).optional().or(z.literal("")),
});

export type TemplateInput = z.infer<typeof templateSchema>;

export const bulkSendSchema = z.object({
  templateKey: z.string().min(1, "Choisissez un modèle"),
  status: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
});

export type BulkSendInput = z.infer<typeof bulkSendSchema>;

const jour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
  .optional()
  .or(z.literal(""));

/**
 * Filtres de l'historique d'envoi (10 novembre 2026).
 *
 * Mêmes conventions que le journal d'audit : paramètres d'URL, chaîne vide
 * acceptée pour « tous », bornes de dates incluses.
 */
export const historiqueSearchSchema = z.object({
  q: z.string().trim().max(200).optional().or(z.literal("")),
  statut: z.enum(["QUEUED", "SENT", "FAILED", "BOUNCED"]).optional().or(z.literal("")),
  modele: z.string().trim().max(120).optional().or(z.literal("")),
  du: jour,
  au: jour,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type HistoriqueSearch = z.infer<typeof historiqueSearchSchema>;
