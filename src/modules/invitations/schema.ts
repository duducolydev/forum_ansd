import { z } from "zod";

export const invitationInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "L'e-mail est requis")
    .email("Adresse e-mail invalide"),
  firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
  lastName: z.string().trim().min(1, "Le nom est requis").max(100),
  organization: z.string().trim().max(200).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  categoryId: z.string().min(1, "La catégorie est requise"),
});

export type InvitationInput = z.infer<typeof invitationInputSchema>;

/** Une ligne de fichier importé (brief §5.5), avant résolution de la catégorie par code. */
export const invitationImportRowSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "E-mail requis").email("E-mail invalide"),
  firstName: z.string().trim().min(1, "Prénom requis").max(100),
  lastName: z.string().trim().min(1, "Nom requis").max(100),
  organization: z.string().trim().max(200).optional().or(z.literal("")),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  categoryCode: z.string().trim().min(1, "Catégorie requise").max(60),
});

export type InvitationImportRow = z.infer<typeof invitationImportRowSchema>;

export const invitationStatusValues = [
  "PENDING",
  "SENT",
  "OPENED",
  "CLICKED",
  "REGISTERED",
  "DECLINED",
  "EXPIRED",
] as const;

export const invitationSearchSchema = z.object({
  q: z.string().trim().optional().or(z.literal("")),
  status: z.enum(invitationStatusValues).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type InvitationSearchInput = z.infer<typeof invitationSearchSchema>;

export const reminderFiltersSchema = z.object({
  categoryId: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
});

export type ReminderFilters = z.infer<typeof reminderFiltersSchema>;
