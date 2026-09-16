import { z } from "zod";

/**
 * CMS léger (brief §5.11) : un bloc = une clé de zone éditoriale → texte FR/EN.
 * Texte brut volontairement (pas de HTML) pour ce premier passage : évite tout
 * risque XSS sans sanitisation dédiée — un vrai éditeur riche est un raffinement
 * ultérieur (cf. PLAN.md).
 */
export const contentBlockInputSchema = z.object({
  key: z.string().min(1),
  valueFr: z.string().trim().min(1, "Le texte français est requis").max(5000),
  valueEn: z.string().trim().max(5000).optional().or(z.literal("")),
});

export type ContentBlockInput = z.infer<typeof contentBlockInputSchema>;

export const postInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Le slug est requis")
    .max(150)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Le slug ne peut contenir que des minuscules, chiffres et tirets",
    ),
  titleFr: z.string().trim().min(1, "Le titre français est requis").max(200),
  titleEn: z.string().trim().max(200).optional().or(z.literal("")),
  /*
   * Chapô : ce que la liste d'actualités et les partages affichent. Plafonné à
   * 300 signes parce qu'au-delà ce n'est plus un résumé — et parce que les
   * aperçus des réseaux sociaux tronquent de toute façon.
   */
  excerptFr: z.string().trim().max(300).optional().or(z.literal("")),
  excerptEn: z.string().trim().max(300).optional().or(z.literal("")),
  bodyFr: z.string().trim().min(1, "Le contenu français est requis").max(10000),
  bodyEn: z.string().trim().max(10000).optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
});

/** Taille maximale d'une image d'article — couverture comme galerie. */
export const IMAGE_ARTICLE_MAX_BYTES = 3 * 1024 * 1024;

/** Une image de galerie, telle que stockée dans `Post.gallery`. */
export const imageGalerieSchema = z.object({
  path: z.string().min(1),
  captionFr: z.string().trim().max(200).default(""),
  captionEn: z.string().trim().max(200).default(""),
});

export const galerieSchema = z.array(imageGalerieSchema).max(20);

export type ImageGalerie = z.infer<typeof imageGalerieSchema>;

/** Lit la galerie d'un article en tolérant un document ancien ou vide. */
export function lireGalerie(brut: unknown): ImageGalerie[] {
  const analyse = galerieSchema.safeParse(brut ?? []);
  return analyse.success ? analyse.data : [];
}

export type PostInput = z.infer<typeof postInputSchema>;
