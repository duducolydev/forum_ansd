import { z } from "zod";

/**
 * Règles de la médiathèque, partagées entre le BackOffice (client) et le
 * serveur. Aucune dépendance serveur ici.
 */

/**
 * Plafonds par photo, **après** réduction dans le navigateur. Les deux tailles
 * partent dans la même requête, que Next limite à 3 Mo.
 */
export const PHOTO_MAX_OCTETS = 2.4 * 1024 * 1024;
export const VIGNETTE_MAX_OCTETS = 300 * 1024;
/** Côté le plus long de la photo affichée en plein écran. */
export const PHOTO_COTE = 2000;
/** Côté le plus long de la vignette des grilles. */
export const VIGNETTE_COTE = 640;

/** Photos par page dans l'onglet « Photos » du site. */
export const PHOTOS_PAR_PAGE = 48;

const texteCourt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const albumSchema = z.object({
  titleFr: z.string().trim().min(2, "Donnez un titre à l'album.").max(150),
  titleEn: texteCourt(150),
  descriptionFr: texteCourt(2000),
  descriptionEn: texteCourt(2000),
  eventDate: z
    .string()
    .trim()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Date invalide.")
    .optional(),
  isPublished: z.boolean().default(false),
});

export type AlbumInput = z.infer<typeof albumSchema>;

export const legendeSchema = z.object({
  captionFr: texteCourt(500),
  captionEn: texteCourt(500),
  credit: texteCourt(150),
});

export type LegendeInput = z.infer<typeof legendeSchema>;

/** Slug lisible dérivé du titre. */
export function slugAlbum(titre: string): string {
  return (
    titre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "album"
  );
}
