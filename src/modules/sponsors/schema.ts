import { z } from "zod";

/**
 * Sponsors et partenaires (brief §5.9).
 *
 * Les champs de contact sont **internes** : le brief les qualifie de « contact
 * interne non public ». Ils ne sortent jamais vers la page publique, ce que le
 * service garantit en n'exposant pas les mêmes projections.
 */
const url = z
  .string()
  .trim()
  .max(500)
  .refine((valeur) => valeur === "" || /^https?:\/\//i.test(valeur), {
    message: "L'adresse doit commencer par http:// ou https://",
  })
  .optional()
  .or(z.literal(""));

export const sponsorInputSchema = z.object({
  name: z.string().trim().min(2, "Le nom est requis.").max(200),
  levelId: z.string().min(1, "Le niveau est requis."),
  descriptionFr: z.string().trim().max(3000).optional().or(z.literal("")),
  descriptionEn: z.string().trim().max(3000).optional().or(z.literal("")),
  website: url,
  videoUrl: url,
  standNumber: z.string().trim().max(40).optional().or(z.literal("")),
  contactName: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(190)
    .email("Adresse e-mail invalide")
    .optional()
    .or(z.literal("")),
  isPublished: z.boolean(),
});

export const niveauInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Le code est requis.")
    .max(40)
    .regex(/^[A-Z0-9_]+$/, "Lettres majuscules, chiffres et tirets bas uniquement."),
  name: z.string().trim().min(2, "Le libellé est requis.").max(120),
  sortOrder: z.coerce.number().int().min(0).max(999),
  /** Largeur d'affichage du logo : un partenaire principal se voit plus qu'un technique. */
  logoMaxWidth: z.coerce.number().int().min(40).max(600).optional(),
});

export type SponsorInput = z.infer<typeof sponsorInputSchema>;
export type NiveauInput = z.infer<typeof niveauInputSchema>;
