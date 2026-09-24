import { z } from "zod";

/** Schéma partagé client/serveur (brief §3.3) — formulaire BackOffice de création/édition. */
export const participantInputSchema = z.object({
  civility: z.string().trim().max(20).optional(),
  firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
  lastName: z.string().trim().min(1, "Le nom est requis").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "L'e-mail est requis")
    .email("Adresse e-mail invalide"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  organization: z.string().trim().max(200).optional().or(z.literal("")),
  organizationType: z.string().trim().max(100).optional().or(z.literal("")),
  activityDomain: z.string().trim().max(150).optional().or(z.literal("")),
  bio: z.string().trim().max(2000).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  country: z.string().trim().min(1, "Le pays est requis").max(100),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  categoryId: z.string().min(1, "La catégorie est requise"),
  delegationId: z.string().optional().or(z.literal("")),
  locale: z.enum(["fr", "en"]).default("fr"),
  attendsOpening: z.boolean().default(false),
  attendsInaugural: z.boolean().default(false),
  attendsAwards: z.boolean().default(false),
  needsAccommodation: z.boolean().default(false),
  needsTransport: z.boolean().default(false),
  dietaryRequirements: z.string().trim().max(300).optional().or(z.literal("")),
  specialNeeds: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type ParticipantInput = z.infer<typeof participantInputSchema>;

export const participantStatusValues = [
  "INVITED",
  "INVITATION_SENT",
  "REGISTRATION_STARTED",
  "REGISTERED",
  "CONFIRMED",
  "BADGED",
  "CHECKED_IN",
  "DECLINED",
  "CANCELLED",
] as const;

export const participantSearchSchema = z.object({
  q: z.string().trim().optional().or(z.literal("")),
  status: z.enum(participantStatusValues).optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  country: z.string().optional().or(z.literal("")),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type ParticipantSearchInput = z.infer<typeof participantSearchSchema>;

export const delegationInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom de la délégation est requis").max(200),
  country: z.string().trim().max(100).optional().or(z.literal("")),
  institution: z.string().trim().max(200).optional().or(z.literal("")),
  /*
   * Référent interne (§28). La chaîne vide vaut « aucun » : c'est la valeur que
   * renvoie un `<select>` dont l'option vide est choisie, et la traiter comme
   * telle évite de faire porter au formulaire une distinction qui n'existe pas
   * pour l'utilisateur.
   */
  referentId: z.string().trim().optional().or(z.literal("")),
  maxMembers: z.coerce.number().int().min(1).max(1000).optional(),
});

export type DelegationInput = z.infer<typeof delegationInputSchema>;
