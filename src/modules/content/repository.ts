import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function listContentBlocks(editionId: string) {
  return prisma.contentBlock.findMany({ where: { editionId }, orderBy: { key: "asc" } });
}

export async function findContentBlock(editionId: string, key: string) {
  return prisma.contentBlock.findUnique({ where: { editionId_key: { editionId, key } } });
}

export async function upsertContentBlock(
  editionId: string,
  key: string,
  data: { valueFr: Prisma.InputJsonValue; valueEn: Prisma.InputJsonValue; updatedById?: string },
) {
  return prisma.contentBlock.upsert({
    where: { editionId_key: { editionId, key } },
    update: data,
    create: { editionId, key, ...data },
  });
}

// ---------------------------------------------------------------------------
// Actualités (Post)
// ---------------------------------------------------------------------------

export async function listPosts(editionId: string, options: { onlyPublished?: boolean } = {}) {
  return prisma.post.findMany({
    where: { editionId, ...(options.onlyPublished ? { isPublished: true } : {}) },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function findPostBySlug(editionId: string, slug: string) {
  return prisma.post.findUnique({ where: { editionId_slug: { editionId, slug } } });
}

export async function findPostById(id: string) {
  return prisma.post.findUnique({ where: { id } });
}

export async function createPost(data: Prisma.PostCreateInput) {
  return prisma.post.create({ data });
}

export async function updatePost(id: string, data: Prisma.PostUpdateInput) {
  return prisma.post.update({ where: { id }, data });
}
