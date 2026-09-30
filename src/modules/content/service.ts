import { revalidateTag, unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { traduire } from "@/lib/langue";
import { audit } from "@/lib/audit";
import * as repo from "./repository";
import { normaliserArticle, normaliserBlocContenu } from "./schema";
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

/**
 * Résout un contenu pour une langue donnée (brief §10), avec repli : le
 * portugais retombe sur l'anglais puis le français, l'anglais sur le français
 * (voir `lib/langue.ts`). `valuePt` est facultatif : les contenus saisis avant
 * l'ajout du portugais n'en ont pas.
 */
export function resolveLocaleValue(
  valueFr: unknown,
  valueEn: unknown,
  locale: string,
  valuePt?: unknown,
): string {
  return traduire(locale, { fr: valueFr, en: valueEn, pt: valuePt });
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
  locale: string,
): Promise<string> {
  const blocs = await blocsEnCache(editionId);
  const block = blocs.find((candidat) => candidat.key === key);
  if (!block) return "";
  return resolveLocaleValue(block.valueFr, block.valueEn, locale, block.valuePt);
}

export async function listContentBlocks(editionId: string) {
  return repo.listContentBlocks(editionId);
}

export async function saveContentBlock(editionId: string, input: ContentBlockInput, actor: Actor) {
  // Nettoyage ici, et non dans l'action : une Server Action n'est pas le seul
  // chemin d'écriture, et un texte mal formé ne doit jamais atteindre la base.
  const propre = normaliserBlocContenu(input);
  const before = await repo.findContentBlock(editionId, propre.key);
  const updated = await repo.upsertContentBlock(editionId, propre.key, {
    valueFr: propre.valueFr,
    valueEn: propre.valueEn || propre.valueFr,
    // Pas de recopie ici : un portugais vide doit laisser l'anglais s'afficher.
    valuePt: propre.valuePt ? propre.valuePt : Prisma.DbNull,
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

export async function createPost(editionId: string, entree: PostInput, actor: Actor) {
  const input = normaliserArticle(entree);
  const post = await repo.createPost({
    edition: { connect: { id: editionId } },
    slug: input.slug,
    titleFr: input.titleFr,
    titleEn: input.titleEn || input.titleFr,
    titlePt: input.titlePt?.trim() || null,
    excerptFr: input.excerptFr?.trim() || null,
    excerptEn: input.excerptEn?.trim() || input.excerptFr?.trim() || null,
    excerptPt: input.excerptPt?.trim() || null,
    bodyFr: input.bodyFr,
    bodyEn: input.bodyEn || input.bodyFr,
    bodyPt: input.bodyPt || null,
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

export async function updatePost(postId: string, entree: PostInput, actor: Actor) {
  const input = normaliserArticle(entree);
  const before = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const becomingPublished = input.isPublished && !before.isPublished;

  const updated = await repo.updatePost(postId, {
    slug: input.slug,
    titleFr: input.titleFr,
    titleEn: input.titleEn || input.titleFr,
    titlePt: input.titlePt?.trim() || null,
    excerptFr: input.excerptFr?.trim() || null,
    excerptEn: input.excerptEn?.trim() || input.excerptFr?.trim() || null,
    excerptPt: input.excerptPt?.trim() || null,
    bodyFr: input.bodyFr,
    bodyEn: input.bodyEn || input.bodyFr,
    bodyPt: input.bodyPt || null,
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
