import type { Langue } from "@/lib/langue";
import { randomBytes } from "node:crypto";
import type { MediaAlbum, MediaItem } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { urlVersionnee } from "@/lib/url-fichier";
import { detectImageType } from "@/modules/participants/photo";
import { lireGalerie } from "@/modules/content/schema";
import { resolveLocaleValue } from "@/modules/content/service";
import {
  PHOTO_MAX_OCTETS,
  PHOTOS_PAR_PAGE,
  VIGNETTE_MAX_OCTETS,
  slugAlbum,
  type AlbumInput,
  type LegendeInput,
} from "./schema";
import { lireLienVideo, urlLecteur, urlPageVideo, vignetteFournisseur } from "./video";

/**
 * Médiathèque (29 septembre 2026) : albums, photos et vidéos du Forum, et les
 * images des actualités, reprises **dynamiquement** — elles ne sont pas
 * copiées : une image retirée d'un article disparaît aussi de la médiathèque.
 *
 * Comme pour les images d'article, le client ne désigne jamais un fichier par
 * son chemin : les routes publiques servent un élément par son identifiant,
 * et le serveur relit le chemin en base.
 */

export interface Actor {
  type: "USER" | "SYSTEM";
  userId?: string;
}

export class MediaError extends Error {}

function journal(
  acteur: Actor,
  action: string,
  entityId: string,
  after?: Record<string, unknown>,
): Promise<void> {
  return audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action,
    entity: action.startsWith("media_album") ? "MediaAlbum" : "MediaItem",
    entityId,
    after,
  });
}

// ---------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------

async function slugLibre(editionId: string, titre: string, exceptId?: string): Promise<string> {
  const base = slugAlbum(titre);
  for (let rang = 1; ; rang += 1) {
    const candidat = rang === 1 ? base : `${base}-${rang}`;
    const existant = await prisma.mediaAlbum.findFirst({
      where: { editionId, slug: candidat, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (!existant) return candidat;
  }
}

function donneesAlbum(input: AlbumInput) {
  return {
    titleFr: input.titleFr,
    titleEn: input.titleEn || input.titleFr,
    titlePt: input.titlePt || null,
    descriptionFr: input.descriptionFr || null,
    descriptionEn: input.descriptionEn || null,
    descriptionPt: input.descriptionPt || null,
    eventDate: input.eventDate ? new Date(`${input.eventDate}T12:00:00Z`) : null,
    isPublished: input.isPublished,
  };
}

export async function creerAlbum(
  editionId: string,
  input: AlbumInput,
  acteur: Actor,
): Promise<MediaAlbum> {
  const dernier = await prisma.mediaAlbum.aggregate({
    where: { editionId },
    _max: { sortOrder: true },
  });
  const album = await prisma.mediaAlbum.create({
    data: {
      editionId,
      slug: await slugLibre(editionId, input.titleFr),
      sortOrder: (dernier._max.sortOrder ?? 0) + 10,
      ...donneesAlbum(input),
    },
  });
  await journal(acteur, "media_album.created", album.id, { titre: album.titleFr });
  return album;
}

export async function modifierAlbum(
  albumId: string,
  input: AlbumInput,
  acteur: Actor,
): Promise<MediaAlbum> {
  const avant = await prisma.mediaAlbum.findUniqueOrThrow({ where: { id: albumId } });
  const album = await prisma.mediaAlbum.update({
    where: { id: albumId },
    data: {
      ...donneesAlbum(input),
      // Le slug suit le titre tant que l'album n'a jamais été publié ; ensuite,
      // il reste : une adresse partagée ne doit pas se casser.
      ...(avant.isPublished || avant.titleFr === input.titleFr
        ? {}
        : { slug: await slugLibre(avant.editionId, input.titleFr, albumId) }),
    },
  });
  await journal(acteur, "media_album.updated", albumId, { publie: album.isPublished });
  return album;
}

async function effacerFichiers(elements: Pick<MediaItem, "filePath" | "thumbPath">[]) {
  for (const element of elements) {
    for (const chemin of [element.filePath, element.thumbPath]) {
      if (chemin) await fileStorage.delete(chemin).catch(() => undefined);
    }
  }
}

/** Supprime l'album, ses éléments et leurs fichiers. */
export async function supprimerAlbum(albumId: string, acteur: Actor): Promise<void> {
  const elements = await prisma.mediaItem.findMany({
    where: { albumId },
    select: { filePath: true, thumbPath: true },
  });
  await prisma.mediaAlbum.delete({ where: { id: albumId } });
  // Fichiers effacés après la base : dans l'autre ordre, un échec laisserait
  // des éléments pointant vers des fichiers disparus.
  await effacerFichiers(elements);
  await journal(acteur, "media_album.deleted", albumId, { elements: elements.length });
}

export async function definirCouverture(
  albumId: string,
  itemId: string,
  acteur: Actor,
): Promise<void> {
  const element = await prisma.mediaItem.findUnique({
    where: { id: itemId },
    select: { albumId: true },
  });
  if (element?.albumId !== albumId) throw new MediaError("Cet élément n'est pas dans l'album.");
  await prisma.mediaAlbum.update({ where: { id: albumId }, data: { coverItemId: itemId } });
  await journal(acteur, "media_album.cover_set", albumId, { itemId });
}

// ---------------------------------------------------------------------------
// Éléments
// ---------------------------------------------------------------------------

async function verifierAlbum(editionId: string, albumId: string | null): Promise<void> {
  if (!albumId) return;
  const album = await prisma.mediaAlbum.findUnique({
    where: { id: albumId },
    select: { editionId: true },
  });
  if (album?.editionId !== editionId) throw new MediaError("Album introuvable.");
}

async function rangSuivant(editionId: string, albumId: string | null): Promise<number> {
  const dernier = await prisma.mediaItem.aggregate({
    where: { editionId, albumId },
    _max: { sortOrder: true },
  });
  return (dernier._max.sortOrder ?? 0) + 10;
}

/** Vérifie les octets (type réel, jamais l'extension) puis enregistre. */
async function enregistrerImage(fichier: File, dossier: string, limite: number): Promise<string> {
  if (fichier.size === 0) throw new MediaError("Fichier vide.");
  if (fichier.size > limite) {
    throw new MediaError(`Image trop lourde (${Math.round(limite / 1024)} Ko au plus).`);
  }
  const octets = Buffer.from(await fichier.arrayBuffer());
  const detecte = detectImageType(octets);
  if (!detecte || detecte.type === "image/svg+xml") {
    throw new MediaError("Format d'image non reconnu (JPEG, PNG ou WebP).");
  }
  const chemin = `medias/${dossier}/${randomBytes(8).toString("hex")}.${detecte.extension}`;
  await fileStorage.put(chemin, octets, detecte.type);
  return chemin;
}

function legendes(input: LegendeInput) {
  return {
    captionFr: input.captionFr || null,
    captionEn: input.captionEn || null,
    captionPt: input.captionPt || null,
    credit: input.credit || null,
  };
}

export async function ajouterPhoto(
  editionId: string,
  albumId: string | null,
  entree: {
    photo: File;
    vignette: File;
    largeur: number | null;
    hauteur: number | null;
    legende: LegendeInput;
  },
  acteur: Actor,
): Promise<MediaItem> {
  await verifierAlbum(editionId, albumId);
  const filePath = await enregistrerImage(entree.photo, "photos", PHOTO_MAX_OCTETS);
  let thumbPath: string;
  try {
    thumbPath = await enregistrerImage(entree.vignette, "vignettes", VIGNETTE_MAX_OCTETS);
  } catch (erreur) {
    await fileStorage.delete(filePath).catch(() => undefined);
    throw erreur;
  }

  const element = await prisma.mediaItem.create({
    data: {
      editionId,
      albumId,
      type: "PHOTO",
      filePath,
      thumbPath,
      width: entree.largeur,
      height: entree.hauteur,
      sortOrder: await rangSuivant(editionId, albumId),
      ...legendes(entree.legende),
    },
  });
  await journal(acteur, "media_item.photo_added", element.id, { albumId });
  return element;
}

export async function ajouterVideo(
  editionId: string,
  albumId: string | null,
  entree: { lien: string; vignette: File | null; legende: LegendeInput },
  acteur: Actor,
): Promise<MediaItem> {
  await verifierAlbum(editionId, albumId);
  const video = lireLienVideo(entree.lien);
  if (!video) {
    throw new MediaError(
      "Lien non reconnu : collez l'adresse d'une vidéo YouTube (youtube.com, youtu.be) ou Vimeo.",
    );
  }
  const thumbPath =
    entree.vignette && entree.vignette.size > 0
      ? await enregistrerImage(entree.vignette, "vignettes", VIGNETTE_MAX_OCTETS)
      : null;

  const element = await prisma.mediaItem.create({
    data: {
      editionId,
      albumId,
      type: "VIDEO",
      videoProvider: video.fournisseur,
      videoId: video.identifiant,
      thumbPath,
      sortOrder: await rangSuivant(editionId, albumId),
      ...legendes(entree.legende),
    },
  });
  await journal(acteur, "media_item.video_added", element.id, { albumId, ...video });
  return element;
}

export async function modifierLegende(
  itemId: string,
  input: LegendeInput,
  acteur: Actor,
): Promise<void> {
  await prisma.mediaItem.update({ where: { id: itemId }, data: legendes(input) });
  await journal(acteur, "media_item.caption_updated", itemId);
}

export async function basculerVisibilite(itemId: string, acteur: Actor): Promise<void> {
  const element = await prisma.mediaItem.findUniqueOrThrow({
    where: { id: itemId },
    select: { isPublished: true },
  });
  await prisma.mediaItem.update({
    where: { id: itemId },
    data: { isPublished: !element.isPublished },
  });
  await journal(acteur, "media_item.visibility_toggled", itemId, {
    publie: !element.isPublished,
  });
}

/** Échange la place de l'élément avec son voisin, dans le même album. */
export async function deplacerElement(itemId: string, sens: -1 | 1): Promise<void> {
  const element = await prisma.mediaItem.findUniqueOrThrow({ where: { id: itemId } });
  const voisin = await prisma.mediaItem.findFirst({
    where: {
      editionId: element.editionId,
      albumId: element.albumId,
      sortOrder: sens < 0 ? { lt: element.sortOrder } : { gt: element.sortOrder },
    },
    orderBy: { sortOrder: sens < 0 ? "desc" : "asc" },
  });
  if (!voisin) return;
  await prisma.$transaction([
    prisma.mediaItem.update({ where: { id: element.id }, data: { sortOrder: voisin.sortOrder } }),
    prisma.mediaItem.update({ where: { id: voisin.id }, data: { sortOrder: element.sortOrder } }),
  ]);
}

/** Range un élément dans un album, ou l'en sort (`null`). */
export async function changerAlbum(
  itemId: string,
  albumId: string | null,
  acteur: Actor,
): Promise<void> {
  const element = await prisma.mediaItem.findUniqueOrThrow({ where: { id: itemId } });
  if (element.albumId === albumId) return;
  await verifierAlbum(element.editionId, albumId);
  await prisma.$transaction([
    // L'ancien album perd sa couverture si c'était cet élément.
    prisma.mediaAlbum.updateMany({
      where: { coverItemId: itemId },
      data: { coverItemId: null },
    }),
    prisma.mediaItem.update({
      where: { id: itemId },
      data: { albumId, sortOrder: await rangSuivant(element.editionId, albumId) },
    }),
  ]);
  await journal(acteur, "media_item.moved", itemId, { de: element.albumId, vers: albumId });
}

export async function supprimerElement(itemId: string, acteur: Actor): Promise<void> {
  const element = await prisma.mediaItem.findUniqueOrThrow({ where: { id: itemId } });
  await prisma.$transaction([
    prisma.mediaAlbum.updateMany({ where: { coverItemId: itemId }, data: { coverItemId: null } }),
    prisma.mediaItem.delete({ where: { id: itemId } }),
  ]);
  await effacerFichiers([element]);
  await journal(acteur, "media_item.deleted", itemId, { type: element.type });
}

// ---------------------------------------------------------------------------
// Lecture — BackOffice
// ---------------------------------------------------------------------------

export async function listerAlbums(editionId: string) {
  return prisma.mediaAlbum.findMany({
    where: { editionId },
    orderBy: [{ eventDate: "desc" }, { sortOrder: "desc" }],
    include: {
      _count: { select: { items: true } },
      items: { orderBy: { sortOrder: "asc" }, take: 1, where: { type: "PHOTO" } },
    },
  });
}

export async function trouverAlbum(albumId: string) {
  return prisma.mediaAlbum.findUnique({
    where: { id: albumId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function elementsHorsAlbum(editionId: string) {
  return prisma.mediaItem.findMany({
    where: { editionId, albumId: null },
    orderBy: { sortOrder: "asc" },
  });
}

/** Élément avec ce qu'il faut pour décider s'il est public. */
export async function trouverElement(itemId: string) {
  return prisma.mediaItem.findUnique({
    where: { id: itemId },
    include: { album: { select: { isPublished: true } } },
  });
}

export function estPublic(element: {
  isPublished: boolean;
  album: { isPublished: boolean } | null;
}): boolean {
  return element.isPublished && (element.album?.isPublished ?? true);
}

// ---------------------------------------------------------------------------
// Lecture — site public
// ---------------------------------------------------------------------------

/** Ce que la galerie publique reçoit d'un élément : des adresses, jamais des chemins. */
export interface ElementGalerie {
  id: string;
  type: "photo" | "video";
  vignette: string | null;
  image: string | null;
  lecteur: string | null;
  pageVideo: string | null;
  legende: string;
  credit: string | null;
  largeur: number | null;
  hauteur: number | null;
  /** Article d'où vient l'image, pour les images des actualités. */
  source: { titre: string; href: string } | null;
}

export function urlFichier(
  element: Pick<MediaItem, "id" | "filePath" | "thumbPath">,
  taille: "photo" | "vignette",
): string | null {
  const chemin = taille === "photo" ? element.filePath : element.thumbPath;
  return chemin ? urlVersionnee(`/api/v1/medias/${element.id}/${taille}`, chemin) : null;
}

export function versElementGalerie(element: MediaItem, locale: Langue): ElementGalerie {
  const video = element.type === "VIDEO";
  const provider = element.videoProvider ?? "";
  const videoId = element.videoId ?? "";
  return {
    id: element.id,
    type: video ? "video" : "photo",
    vignette:
      urlFichier(element, "vignette") ?? (video ? vignetteFournisseur(provider, videoId) : null),
    image: video ? null : urlFichier(element, "photo"),
    lecteur: video ? urlLecteur(provider, videoId) : null,
    pageVideo: video ? urlPageVideo(provider, videoId) : null,
    legende: resolveLocaleValue(
      element.captionFr ?? "",
      element.captionEn ?? "",
      locale,
      element.captionPt,
    ),
    credit: element.credit,
    largeur: element.width,
    hauteur: element.height,
    source: null,
  };
}

const VISIBLE = { isPublished: true, OR: [{ albumId: null }, { album: { isPublished: true } }] };

/** Albums publiés ayant au moins un élément visible, avec leur couverture. */
export async function albumsPublies(editionId: string) {
  const albums = await prisma.mediaAlbum.findMany({
    where: { editionId, isPublished: true },
    orderBy: [{ eventDate: "desc" }, { sortOrder: "desc" }],
    include: {
      items: {
        where: { isPublished: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          type: true,
          filePath: true,
          thumbPath: true,
          videoProvider: true,
          videoId: true,
        },
      },
    },
  });

  return albums
    .filter((album) => album.items.length > 0)
    .map((album) => {
      const couverture =
        album.items.find((item) => item.id === album.coverItemId) ??
        album.items.find((item) => item.type === "PHOTO") ??
        album.items[0]!;
      const vignette =
        urlFichier(couverture, "vignette") ??
        vignetteFournisseur(couverture.videoProvider ?? "", couverture.videoId ?? "");
      return {
        id: album.id,
        slug: album.slug,
        titleFr: album.titleFr,
        titleEn: album.titleEn,
        titlePt: album.titlePt,
        eventDate: album.eventDate,
        vignette,
        photos: album.items.filter((item) => item.type === "PHOTO").length,
        videos: album.items.filter((item) => item.type === "VIDEO").length,
      };
    });
}

export async function albumPublie(editionId: string, slug: string) {
  return prisma.mediaAlbum.findFirst({
    where: { editionId, slug, isPublished: true },
    include: { items: { where: { isPublished: true }, orderBy: { sortOrder: "asc" } } },
  });
}

export async function videosPubliques(editionId: string): Promise<MediaItem[]> {
  return prisma.mediaItem.findMany({
    where: { editionId, type: "VIDEO", ...VISIBLE },
    orderBy: { createdAt: "desc" },
  });
}

/** Images des actualités publiées : couverture puis galerie, par article. */
export async function imagesActualites(editionId: string, locale: Langue) {
  const articles = await prisma.post.findMany({
    where: { editionId, isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      titleFr: true,
      titleEn: true,
      titlePt: true,
      publishedAt: true,
      coverPath: true,
      gallery: true,
    },
  });

  return articles
    .map((article) => {
      const titre = resolveLocaleValue(article.titleFr, article.titleEn, locale, article.titlePt);
      const source = { titre, href: `/actualites/${article.slug}` };
      const base = `/api/v1/posts/${article.id}/image`;
      const images: ElementGalerie[] = [];
      if (article.coverPath) {
        const url = urlVersionnee(`${base}/couverture`, article.coverPath);
        images.push({
          id: `${article.id}-couverture`,
          type: "photo",
          vignette: url,
          image: url,
          lecteur: null,
          pageVideo: null,
          legende: titre,
          credit: null,
          largeur: null,
          hauteur: null,
          source,
        });
      }
      lireGalerie(article.gallery).forEach((image, rang) => {
        const url = urlVersionnee(`${base}/${rang}`, image.path);
        images.push({
          id: `${article.id}-${rang}`,
          type: "photo",
          vignette: url,
          image: url,
          lecteur: null,
          pageVideo: null,
          legende:
            resolveLocaleValue(image.captionFr, image.captionEn, locale, image.captionPt) || titre,
          credit: null,
          largeur: null,
          hauteur: null,
          source,
        });
      });
      return { article: { ...source, date: article.publishedAt }, images };
    })
    .filter((groupe) => groupe.images.length > 0);
}

/**
 * Toutes les photos publiques — médiathèque et actualités — des plus récentes
 * aux plus anciennes, par page.
 */
export async function photosPubliques(editionId: string, locale: Langue, page: number) {
  const [photos, actualites] = await Promise.all([
    prisma.mediaItem.findMany({
      where: { editionId, type: "PHOTO", ...VISIBLE },
      orderBy: { createdAt: "desc" },
    }),
    imagesActualites(editionId, locale),
  ]);

  const toutes = [
    ...photos.map((photo) => ({
      date: photo.createdAt.getTime(),
      element: versElementGalerie(photo, locale),
    })),
    ...actualites.flatMap((groupe) =>
      groupe.images.map((element) => ({ date: groupe.article.date?.getTime() ?? 0, element })),
    ),
  ].sort((a, b) => b.date - a.date);

  const pages = Math.max(1, Math.ceil(toutes.length / PHOTOS_PAR_PAGE));
  const courante = Math.min(Math.max(1, page), pages);
  return {
    elements: toutes
      .slice((courante - 1) * PHOTOS_PAR_PAGE, courante * PHOTOS_PAR_PAGE)
      .map((entree) => entree.element),
    total: toutes.length,
    page: courante,
    pages,
  };
}
