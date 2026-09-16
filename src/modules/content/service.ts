import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import * as repo from "./repository";
import type { ContentBlockInput, PostInput } from "./schema";

/**
 * Étiquette de cache des contenus éditoriaux.
 *
 * Le brief (§8) demande un cache ISR de 60 s sur les pages publiques. Il n'est
 * pas atteignable en l'état : la langue et le thème sont lus dans les cookies
 * par le gabarit, ce qui rend chaque page dépendante du visiteur — vérifié en
 * observant que `/` renvoie `lang="en"` avec `NEXT_LOCALE=en` et
 * `Cache-Control: no-store`. Rendre l'ISR possible supposerait de déplacer la
 * langue dans l'URL, donc de réécrire toutes les adresses publiques, leur
 * référencement et le plan du site — pour un gain que la charge visée
 * (1 500 participants, TTFB mesuré à 112 ms) ne justifie pas.
 *
 * Le cache de 60 s est donc posé **sur les données** plutôt que sur la page :
 * ce qui coûte est la lecture en base, et elle ne dépend ni du thème ni de la
 * langue du visiteur. Décision consignée en C13 / T35.
 */
const ETIQUETTE_CONTENU = "contenu-public";

export interface Actor {
  type: "USER" | "PARTICIPANT" | "SYSTEM";
  userId?: string;
}

/** Résout un bloc pour une locale donnée, avec repli sur le FR si l'EN est vide (brief §10). */
export function resolveLocaleValue(
  valueFr: unknown,
  valueEn: unknown,
  locale: "fr" | "en",
): string {
  const fr = typeof valueFr === "string" ? valueFr : "";
  const en = typeof valueEn === "string" ? valueEn : "";
  if (locale === "en") {
    return en.trim().length > 0 ? en : fr;
  }
  return fr;
}

/**
 * Blocs éditoriaux d'une édition, en une lecture mise en cache.
 *
 * Une seule requête pour tous les blocs plutôt qu'une par clé : la page
 * d'accueil en demande trois, « à propos » davantage, et chacune payait
 * jusqu'ici son aller-retour.
 */
const blocsEnCache = unstable_cache(
  async (editionId: string) => repo.listContentBlocks(editionId),
  ["content-blocks"],
  { revalidate: 60, tags: [ETIQUETTE_CONTENU] },
);

export async function getContentText(
  editionId: string,
  key: string,
  locale: "fr" | "en",
): Promise<string> {
  const blocs = await blocsEnCache(editionId);
  const block = blocs.find((candidat) => candidat.key === key);
  if (!block) return "";
  return resolveLocaleValue(block.valueFr, block.valueEn, locale);
}

export async function listContentBlocks(editionId: string) {
  return repo.listContentBlocks(editionId);
}

export async function saveContentBlock(editionId: string, input: ContentBlockInput, actor: Actor) {
  const before = await repo.findContentBlock(editionId, input.key);
  const updated = await repo.upsertContentBlock(editionId, input.key, {
    valueFr: input.valueFr,
    valueEn: input.valueEn || input.valueFr,
    updatedById: actor.userId,
  });

  // Sans cette invalidation, un texte corrigé mettrait jusqu'à une minute à
  // paraître, et l'éditeur croirait son enregistrement perdu.
  revalidateTag(ETIQUETTE_CONTENU);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: before ? "content_block.update" : "content_block.create",
    entity: "ContentBlock",
    entityId: updated.id,
    before: before ? { valueFr: before.valueFr } : undefined,
    after: { valueFr: updated.valueFr },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Actualités
// ---------------------------------------------------------------------------

export async function listPosts(editionId: string, options: { onlyPublished?: boolean } = {}) {
  return repo.listPosts(editionId, options);
}

export async function getPostBySlug(editionId: string, slug: string) {
  return repo.findPostBySlug(editionId, slug);
}

export async function getPost(id: string) {
  return repo.findPostById(id);
}

export async function createPost(editionId: string, input: PostInput, actor: Actor) {
  const post = await repo.createPost({
    edition: { connect: { id: editionId } },
    slug: input.slug,
    titleFr: input.titleFr,
    titleEn: input.titleEn || input.titleFr,
    excerptFr: input.excerptFr?.trim() || null,
    excerptEn: input.excerptEn?.trim() || input.excerptFr?.trim() || null,
    bodyFr: input.bodyFr,
    bodyEn: input.bodyEn || input.bodyFr,
    isPublished: input.isPublished,
    publishedAt: input.isPublished ? new Date() : null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "post.create",
    entity: "Post",
    entityId: post.id,
    after: { slug: post.slug, isPublished: post.isPublished },
  });

  return post;
}

export async function updatePost(postId: string, input: PostInput, actor: Actor) {
  const before = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const becomingPublished = input.isPublished && !before.isPublished;

  const updated = await repo.updatePost(postId, {
    slug: input.slug,
    titleFr: input.titleFr,
    titleEn: input.titleEn || input.titleFr,
    excerptFr: input.excerptFr?.trim() || null,
    excerptEn: input.excerptEn?.trim() || input.excerptFr?.trim() || null,
    bodyFr: input.bodyFr,
    bodyEn: input.bodyEn || input.bodyFr,
    isPublished: input.isPublished,
    publishedAt: becomingPublished ? new Date() : before.publishedAt,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "post.update",
    entity: "Post",
    entityId: postId,
    before: { isPublished: before.isPublished },
    after: { isPublished: updated.isPublished },
  });

  return updated;
}
