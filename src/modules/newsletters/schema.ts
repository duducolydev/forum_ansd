import { z } from "zod";
import {
  nettoyerDoc,
  serialiserTexteRiche,
  texteBrut,
  TAILLE_MAX_DOCUMENT,
} from "@/lib/texte-riche";

/**
 * Saisie d'une newsletter (§34).
 *
 * Le corps est un **document structuré** sérialisé, jamais du HTML : voir
 * l'en-tête de `lib/texte-riche.ts` pour la raison. Il est nettoyé ici, au
 * franchissement de la frontière, et non à l'affichage — un nettoyage à
 * l'affichage s'oublie sur la page qu'on ajoute six mois plus tard.
 */

/** Longueur maximale du corps, en texte visible : les images n'y comptent pas. */
export const LONGUEUR_MAX_CORPS = 20_000;

/** Limite d'une image insérée dans le corps. */
export const IMAGE_NEWSLETTER_MAX_BYTES = 3 * 1024 * 1024;

export const newsletterInputSchema = z.object({
  titleFr: z.string().trim().min(1, "Le titre en français est requis").max(200),
  titleEn: z.string().trim().max(200).optional().or(z.literal("")),
  excerptFr: z
    .string()
    .trim()
    .min(1, "Le chapô en français est requis")
    .max(600, "Le chapô tient en 600 caractères : c'est lui qui part dans l'e-mail."),
  excerptEn: z.string().trim().max(600).optional().or(z.literal("")),
  bodyFr: z.string().max(TAILLE_MAX_DOCUMENT),
  bodyEn: z.string().max(TAILLE_MAX_DOCUMENT),
  isPublished: z.coerce.boolean().default(false),
});

export type NewsletterInput = z.infer<typeof newsletterInputSchema>;

export class NewsletterRuleError extends Error {}

/**
 * Nettoie les deux corps et vérifie leur longueur visible.
 *
 * `images: true` : c'est le seul document du site qui en porte. Le nettoyage
 * borne l'alignement et la largeur de chacune, et écarte les rangs qui ne
 * désignent aucune image.
 */
export function normaliserNewsletter(input: NewsletterInput): NewsletterInput {
  const nettoyer = (brut: string, langue: string): string => {
    let analyse: unknown;
    try {
      analyse = brut.trim() ? JSON.parse(brut) : { type: "doc", content: [] };
    } catch {
      throw new NewsletterRuleError(`Corps en ${langue} illisible.`);
    }

    const doc = nettoyerDoc(analyse, { images: true });
    const longueur = texteBrut(doc).length;
    if (longueur > LONGUEUR_MAX_CORPS) {
      throw new NewsletterRuleError(
        `Le corps en ${langue} dépasse ${LONGUEUR_MAX_CORPS} caractères (${longueur}).`,
      );
    }
    return serialiserTexteRiche(doc);
  };

  return {
    ...input,
    bodyFr: nettoyer(input.bodyFr, "français"),
    bodyEn: nettoyer(input.bodyEn, "anglais"),
  };
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
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "newsletter"
  );
}

export function parseNewsletterForm(formData: FormData): NewsletterInput {
  return newsletterInputSchema.parse({
    titleFr: formData.get("titleFr"),
    titleEn: formData.get("titleEn") ?? "",
    excerptFr: formData.get("excerptFr"),
    excerptEn: formData.get("excerptEn") ?? "",
    bodyFr: formData.get("bodyFr") ?? "",
    bodyEn: formData.get("bodyEn") ?? "",
    isPublished: formData.get("isPublished") === "on",
  });
}
