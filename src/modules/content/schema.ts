import { z } from "zod";
import { normaliserTexteRiche, TAILLE_MAX_DOCUMENT } from "@/lib/texte-riche";
import { zoneEditoriale } from "./keys";

/** Contenu refusé : message destiné à la personne qui écrit, pas à la console. */
export class ContenuError extends Error {}

/**
 * CMS léger (brief §5.11) : un bloc = une clé de zone éditoriale → texte FR/EN.
 *
 * Le texte est **mis en forme** depuis §26 : ce que l'éditeur envoie est un
 * document structuré, jamais du HTML. Le schéma ne contrôle ici que la forme du
 * formulaire ; ce qui compte — la nature du champ et la longueur du texte
 * visible — dépend de la clé, et se vérifie dans `normaliserBlocContenu`.
 */
export const contentBlockInputSchema = z.object({
  key: z.string().min(1),
  valueFr: z.string().max(TAILLE_MAX_DOCUMENT),
  valueEn: z.string().max(TAILLE_MAX_DOCUMENT).optional().or(z.literal("")),
});

export type ContentBlockInput = z.infer<typeof contentBlockInputSchema>;

/**
 * Nettoie et vérifie un bloc éditorial selon ce que sa clé déclare.
 *
 * La longueur se mesure sur le **texte visible**, balisage exclu : autrement,
 * trois mots en gras compteraient pour cent signes. Le nettoyage refait au
 * serveur ce que l'éditeur a déjà fait au navigateur — un champ caché se
 * falsifie.
 */
export function normaliserBlocContenu(input: ContentBlockInput): ContentBlockInput {
  const zone = zoneEditoriale(input.key);
  if (!zone) throw new ContenuError("Zone éditoriale inconnue.");

  const nettoyer = (brut: string, langue: string) => {
    const { valeur, longueur } = zone.riche
      ? normaliserTexteRiche(brut)
      : { valeur: brut.trim(), longueur: brut.trim().length };
    if (longueur > zone.max) {
      throw new ContenuError(
        `« ${zone.label} » (${langue}) dépasse ${zone.max} caractères : ${longueur} saisis.`,
      );
    }
    return { valeur, longueur };
  };

  const fr = nettoyer(input.valueFr, "français");
  if (fr.longueur === 0) throw new ContenuError("Le texte français est requis.");
  const en = nettoyer(input.valueEn ?? "", "anglais");

  return { key: input.key, valueFr: fr.valeur, valueEn: en.longueur === 0 ? "" : en.valeur };
}

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
  /*
   * Corps mis en forme (§26) : le contrôle de longueur porte sur le texte
   * visible et vit dans `normaliserArticle`, pas ici — le document structuré
   * pèse plus que ce qu'il affiche.
   */
  bodyFr: z.string().max(TAILLE_MAX_DOCUMENT),
  bodyEn: z.string().max(TAILLE_MAX_DOCUMENT).optional().or(z.literal("")),
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

/** Longueur maximale du corps d'une actualité, en texte visible. */
export const LONGUEUR_MAX_ARTICLE = 10_000;

/** Nettoie et vérifie le corps mis en forme d'une actualité (voir `normaliserBlocContenu`). */
export function normaliserArticle(input: PostInput): PostInput {
  const nettoyer = (brut: string, langue: string) => {
    const { valeur, longueur } = normaliserTexteRiche(brut);
    if (longueur > LONGUEUR_MAX_ARTICLE) {
      throw new ContenuError(
        `Le contenu (${langue}) dépasse ${LONGUEUR_MAX_ARTICLE} caractères : ${longueur} saisis.`,
      );
    }
    return { valeur, longueur };
  };

  const fr = nettoyer(input.bodyFr, "français");
  if (fr.longueur === 0) throw new ContenuError("Le contenu français est requis.");
  const en = nettoyer(input.bodyEn ?? "", "anglais");

  return { ...input, bodyFr: fr.valeur, bodyEn: en.longueur === 0 ? "" : en.valeur };
}
