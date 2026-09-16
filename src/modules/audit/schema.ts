import { z } from "zod";

/**
 * Filtres du journal d'audit (brief §5.14, pagination §6 plafonnée à 200).
 *
 * Chaque champ accepte la chaîne vide : ce sont des paramètres d'URL, et un
 * filtre remis à « tous » arrive sous cette forme plutôt qu'absent.
 */
const jour = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ")
  .optional()
  .or(z.literal(""));

export const auditSearchSchema = z.object({
  q: z.string().trim().max(200).optional().or(z.literal("")),
  action: z.string().trim().max(120).optional().or(z.literal("")),
  entity: z.string().trim().max(120).optional().or(z.literal("")),
  actorUserId: z.string().trim().max(60).optional().or(z.literal("")),
  /** Bornes incluses toutes les deux, exprimées en jours. */
  du: jour,
  au: jour,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type AuditSearch = z.infer<typeof auditSearchSchema>;
