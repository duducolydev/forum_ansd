import { z } from "zod";

/**
 * Formulaire public d'inscription (brief §5.3) — schémas partagés client/serveur,
 * découpés par étape pour la validation pas à pas.
 */

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const registrationIdentitySchema = z.object({
  civility: optionalText(20),
  firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
  lastName: z.string().trim().min(1, "Le nom est requis").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "L'adresse e-mail est requise")
    .email("Adresse e-mail invalide"),
  phone: optionalText(30),
  country: z.string().trim().min(1, "Le pays est requis").max(100),
  city: optionalText(100),
  locale: z.enum(["fr", "en"]).default("fr"),
  categoryId: z.string().min(1, "La catégorie de participation est requise"),
});

export const registrationProfessionSchema = z.object({
  organization: optionalText(200),
  organizationType: optionalText(100),
  jobTitle: optionalText(150),
  activityDomain: optionalText(150),
  bio: z.string().trim().max(300, "300 caractères maximum").optional().or(z.literal("")),
  website: optionalText(300),
});

export const registrationParticipationSchema = z.object({
  participationDays: z.array(z.string()).min(1, "Sélectionnez au moins une journée"),
  attendsOpening: z.boolean().default(false),
  attendsInaugural: z.boolean().default(false),
  attendsAwards: z.boolean().default(false),
});

export const registrationLogisticsSchema = z.object({
  arrivalDate: z.string().trim().optional().or(z.literal("")),
  departureDate: z.string().trim().optional().or(z.literal("")),
  needsAccommodation: z.boolean().default(false),
  needsTransport: z.boolean().default(false),
  dietaryRequirements: optionalText(300),
  specialNeeds: optionalText(300),
});

export const registrationConsentSchema = z.object({
  consentTerms: z
    .boolean()
    .refine((value) => value === true, "Vous devez accepter les conditions de participation"),
  consentData: z
    .boolean()
    .refine(
      (value) => value === true,
      "Le consentement au traitement des données est nécessaire pour vous inscrire",
    ),
  consentImage: z.boolean().default(false),
});

export const registrationSchema = registrationIdentitySchema
  .extend(registrationProfessionSchema.shape)
  .extend(registrationParticipationSchema.shape)
  .extend(registrationLogisticsSchema.shape)
  .extend(registrationConsentSchema.shape)
  .extend({
    invitationToken: z.string().optional().or(z.literal("")),
    captchaToken: z.string().optional().or(z.literal("")),
    /** Honeypot : invisible pour l'utilisateur, rempli par les robots (brief §5.3). */
    fax: z.string().max(0, "Requête rejetée").optional().or(z.literal("")),
  });

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Brouillon serveur : tout est optionnel sauf l'e-mail, qui sert de clé. */
export const registrationDraftSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  categoryId: z.string().min(1),
  firstName: optionalText(100),
  lastName: optionalText(100),
  country: optionalText(100),
  payload: z.string().max(20000),
});

export type RegistrationDraftInput = z.infer<typeof registrationDraftSchema>;

export const REGISTRATION_STEPS = [
  { key: "identity", label: "Identité" },
  { key: "profession", label: "Profession" },
  { key: "participation", label: "Participation" },
  { key: "logistics", label: "Logistique" },
  { key: "consent", label: "Consentements" },
] as const;

export type RegistrationStepKey = (typeof REGISTRATION_STEPS)[number]["key"];
