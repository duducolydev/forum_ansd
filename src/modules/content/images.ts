import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";
import { IMAGE_ARTICLE_MAX_BYTES, lireGalerie, type ImageGalerie } from "./schema";
import type { Actor } from "./service";

export class ImageArticleError extends Error {}

/**
 * Images d'article : couverture et galerie (§8.5).
 *
 * Le chemin de stockage n'est **jamais** fourni par le client. Les routes
 * publiques désignent une image par « couverture » ou par son rang dans la
 * galerie, et le serveur résout le chemin lui-même : une adresse de fichier
 * acceptée depuis l'extérieur se transforme vite en lecture arbitraire.
 */
async function verifierEtEcrire(postId: string, fichier: File, dossier: string): Promise<string> {
  if (fichier.size === 0) throw new ImageArticleError("Aucun fichier reçu.");
  if (fichier.size > IMAGE_ARTICLE_MAX_BYTES) {
    throw new ImageArticleError(
      `Image trop lourde (maximum ${IMAGE_ARTICLE_MAX_BYTES / 1024 / 1024} Mo).`,
    );
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  // Type déduit des octets, jamais de l'extension (§7) : l'image est publiée.
  const detecte = detectImageType(octets);
  if (!detecte) throw new ImageArticleError("Format d'image non reconnu (JPEG, PNG ou WebP).");

  const chemin = `${dossier}/${postId}-${randomBytes(6).toString("hex")}.${detecte.extension}`;
  await fileStorage.put(chemin, octets, detecte.type);
  return chemin;
}

export async function enregistrerCouverture(
  postId: string,
  fichier: File,
  acteur: Actor,
): Promise<void> {
  const avant = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { coverPath: true },
  });

  const chemin = await verifierEtEcrire(postId, fichier, "articles/couvertures");
  await prisma.post.update({ where: { id: postId }, data: { coverPath: chemin } });

  if (avant.coverPath && avant.coverPath !== chemin) {
    await fileStorage.delete(avant.coverPath).catch(() => undefined);
  }

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "post.cover_updated",
    entity: "Post",
    entityId: postId,
  });
}

export async function retirerCouverture(postId: string, acteur: Actor): Promise<void> {
  const avant = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { coverPath: true },
  });
  if (!avant.coverPath) return;

  await prisma.post.update({ where: { id: postId }, data: { coverPath: null } });
  await fileStorage.delete(avant.coverPath).catch(() => undefined);

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "post.cover_removed",
    entity: "Post",
    entityId: postId,
  });
}

/** Plafond de la galerie : au-delà ce n'est plus un article mais un album. */
export const GALERIE_MAX = 20;

export async function ajouterImageGalerie(
  postId: string,
  fichier: File,
  legendes: { fr: string; en: string },
  acteur: Actor,
): Promise<void> {
  const article = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { gallery: true },
  });
  const galerie = lireGalerie(article.gallery);
  if (galerie.length >= GALERIE_MAX) {
    throw new ImageArticleError(`La galerie est limitée à ${GALERIE_MAX} images.`);
  }

  const chemin = await verifierEtEcrire(postId, fichier, "articles/galeries");
  const suivante: ImageGalerie[] = [
    ...galerie,
    { path: chemin, captionFr: legendes.fr, captionEn: legendes.en || legendes.fr },
  ];

  await prisma.post.update({ where: { id: postId }, data: { gallery: suivante } });

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "post.gallery_added",
    entity: "Post",
    entityId: postId,
    after: { images: suivante.length },
  });
}

/**
 * Retrait par **rang** et non par chemin : c'est ce que l'écran connaît, et
 * cela évite d'accepter un chemin de fichier venu du navigateur.
 */
export async function retirerImageGalerie(
  postId: string,
  rang: number,
  acteur: Actor,
): Promise<void> {
  const article = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { gallery: true },
  });
  const galerie = lireGalerie(article.gallery);
  const image = galerie[rang];
  if (!image) throw new ImageArticleError("Image introuvable dans la galerie.");

  const suivante = galerie.filter((_, index) => index !== rang);
  await prisma.post.update({ where: { id: postId }, data: { gallery: suivante } });
  await fileStorage.delete(image.path).catch(() => undefined);

  await audit.log({
    actorType: acteur.type,
    actorUserId: acteur.userId,
    action: "post.gallery_removed",
    entity: "Post",
    entityId: postId,
    after: { images: suivante.length },
  });
}
