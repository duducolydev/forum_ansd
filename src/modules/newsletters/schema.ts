import { z } from "zod";

/**
 * Saisie d'une newsletter (§34, refondue le 25 novembre 2026).
 *
 * Une newsletter est désormais un **titre**, une **description** et un
 * **fichier de synthèse** en PDF, téléchargeable depuis le portail. Le corps
 * mis en forme des premières newsletters n'est plus saisi ; il reste affiché
 * pour celles qui en ont un, et n'est jamais réécrit.
 *
 * Les traductions du titre et de la description sont facultatives : vides, le
 * français est repris, et l'annonce part dans la langue de chaque destinataire.
 */

/** Limite d'une image insérée dans le corps (newsletters antérieures). */
export const IMAGE_NEWSLETTER_MAX_BYTES = 3 * 1024 * 1024;

/**
 * Poids maximal du fichier de synthèse. Il passe par une **route** et non par
 * une Server Action, plafonnée à 3 Mo (voir `contributions/fichier.ts`).
 */
export const FICHIER_NEWSLETTER_MAX_BYTES = 50 * 1024 * 1024;

export const newsletterInputSchema = z.object({
  titleFr: z.string().trim().min(1, "Le titre est requis").max(200),
  titleEn: z.string().trim().max(200).optional().or(z.literal("")),
  titlePt: z.string().trim().max(200).optional().or(z.literal("")),
  excerptFr: z
    .string()
    .trim()
    .min(1, "La description est requise")
    .max(600, "La description tient en 600 caractères : c'est elle qui part dans l'e-mail."),
  excerptEn: z.string().trim().max(600).optional().or(z.literal("")),
  excerptPt: z.string().trim().max(600).optional().or(z.literal("")),
});

export type NewsletterInput = z.infer<typeof newsletterInputSchema>;

export class NewsletterRuleError extends Error {}

export function parseNewsletterForm(formData: FormData): NewsletterInput {
  return newsletterInputSchema.parse({
    titleFr: formData.get("titleFr"),
    titleEn: formData.get("titleEn") ?? "",
    titlePt: formData.get("titlePt") ?? "",
    excerptFr: formData.get("excerptFr"),
    excerptEn: formData.get("excerptEn") ?? "",
    excerptPt: formData.get("excerptPt") ?? "",
  });
}

/** Statuts visés par défaut : ceux qui ont manifesté leur intérêt, hors désistés et annulés. */
export const STATUTS_NEWSLETTER = ["REGISTERED", "CONFIRMED", "BADGED", "CHECKED_IN"] as const;

/**
 * Population visée et boîtes retenues pour l'envoi.
 *
 * Aucune catégorie cochée veut dire **toutes** : c'est le cas courant, et une
 * liste vide qui n'enverrait à personne serait un piège.
 */
export const ciblageSchema = z.object({
  categoryIds: z.array(z.string().min(1)).max(100).default([]),
  statuts: z.array(z.enum(STATUTS_NEWSLETTER)).min(1, "Choisissez au moins un statut."),
  boites: z
    .array(z.enum(["transactionnel", "campagne", "acces", "inscription", "participation"]))
    .min(1, "Choisissez au moins une boîte d'envoi."),
});

export type Ciblage = z.infer<typeof ciblageSchema>;

/** Population enregistrée avec la newsletter, relue sans faire confiance à la base. */
export function lireAudience(brut: unknown): { categoryIds: string[]; statuts: string[] } | null {
  const analyse = z
    .object({ categoryIds: z.array(z.string()), statuts: z.array(z.string()) })
    .safeParse(brut);
  return analyse.success ? analyse.data : null;
}

/** Image du corps : seul le chemin est stocké, le document n'en connaît que le rang. */
const imageSchema = z.object({ path: z.string().min(1) });
const imagesSchema = z.array(imageSchema);

export type ImageNewsletter = z.infer<typeof imageSchema>;

export function lireImages(brut: unknown): ImageNewsletter[] {
  const analyse = imagesSchema.safeParse(brut ?? []);
  return analyse.success ? analyse.data : [];
}

/**
 * Adresse de la newsletter, dérivée du titre français.
 *
 * Calculée une fois, à la création, puis figée : elle entre dans les liens
 * envoyés par e-mail, et la changer après coup casserait tous ceux déjà partis.
 */
export function slugDepuisTitre(titre: string): string {
  return (
    titre
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "newsletter"
  );
}

/**
 * Nom proposé au téléchargement : celui d'origine, débarrassé de ce qui
 * casserait l'en-tête `Content-Disposition`, toujours terminé par `.pdf`.
 */
export function nomFichierPropre(nom: string | null | undefined, repli: string): string {
  const base = (nom ?? "")
    .replace(/\.pdf$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\- .]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || slugDepuisTitre(repli)}.pdf`;
}

/** « 2,4 Mo », « 830 Ko » ; « 2.4 MB » hors du français. */
export function poidsLisible(octets: number | null | undefined, locale = "fr-FR"): string {
  if (!octets) return "";
  const francais = locale.startsWith("fr");
  if (octets < 1024 * 1024) {
    return `${Math.max(1, Math.round(octets / 1024))} ${francais ? "Ko" : "KB"}`;
  }
  const mega = (octets / 1024 / 1024).toLocaleString(locale, { maximumFractionDigits: 1 });
  return `${mega} ${francais ? "Mo" : "MB"}`;
}
