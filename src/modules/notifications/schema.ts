import { z } from "zod";

/** Édition d'un modèle en BackOffice (brief §5.13). La clé et le canal ne sont pas modifiables. */
export const templateSchema = z.object({
  subjectFr: z.string().trim().max(300).optional().or(z.literal("")),
  subjectEn: z.string().trim().max(300).optional().or(z.literal("")),
  bodyFr: z.string().trim().min(1, "Le corps en français est requis").max(20000),
  bodyEn: z.string().trim().min(1, "Le corps en anglais est requis").max(20000),
});

export type TemplateInput = z.infer<typeof templateSchema>;

export const bulkSendSchema = z.object({
  templateKey: z.string().min(1, "Choisissez un modèle"),
  status: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
});

export type BulkSendInput = z.infer<typeof bulkSendSchema>;
