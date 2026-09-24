import type { Prisma, ParticipantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Champs ciblés pour la liste BackOffice — un seul aller-retour, pas de N+1 (brief §3.3). */
const PARTICIPANT_LIST_SELECT = {
  id: true,
  publicId: true,
  civility: true,
  firstName: true,
  lastName: true,
  email: true,
  organization: true,
  country: true,
  status: true,
  source: true,
  createdAt: true,
  category: { select: { id: true, labelFr: true, labelEn: true, color: true } },
  delegation: { select: { id: true, name: true } },
  badges: {
    select: { version: true, revokedAt: true },
    orderBy: { version: "desc" as const },
    take: 1,
  },
} satisfies Prisma.ParticipantSelect;

export type ParticipantListItem = Prisma.ParticipantGetPayload<{
  select: typeof PARTICIPANT_LIST_SELECT;
}>;

export interface ParticipantListFilters {
  editionId: string;
  q?: string;
  status?: ParticipantStatus;
  categoryId?: string;
  country?: string;
  page: number;
  pageSize: number;
}

function buildWhere(filters: ParticipantListFilters): Prisma.ParticipantWhereInput {
  return {
    editionId: filters.editionId,
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(filters.q
      ? {
          OR: [
            { firstName: { contains: filters.q } },
            { lastName: { contains: filters.q } },
            { email: { contains: filters.q } },
            { organization: { contains: filters.q } },
            { publicId: { contains: filters.q } },
          ],
        }
      : {}),
  };
}

export async function listParticipants(
  filters: ParticipantListFilters,
): Promise<{ items: ParticipantListItem[]; total: number }> {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.participant.findMany({
      where,
      select: PARTICIPANT_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.participant.count({ where }),
  ]);
  return { items, total };
}

export async function listCategories(editionId: string) {
  return prisma.participantCategory.findMany({
    where: { editionId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function findParticipantById(id: string) {
  return prisma.participant.findUnique({
    where: { id },
    include: {
      category: true,
      delegation: true,
      badges: { orderBy: { version: "desc" } },
      invitation: true,
    },
  });
}

export async function findParticipantByEmail(editionId: string, email: string) {
  return prisma.participant.findUnique({
    where: { editionId_email: { editionId, email: email.toLowerCase() } },
  });
}

export async function createParticipant(data: Prisma.ParticipantCreateInput) {
  return prisma.participant.create({ data });
}

export async function updateParticipant(id: string, data: Prisma.ParticipantUpdateInput) {
  return prisma.participant.update({ where: { id }, data });
}

export async function softDeleteParticipant(id: string) {
  return prisma.participant.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ---------------------------------------------------------------------------
// Délégations
// ---------------------------------------------------------------------------

export async function listDelegations(editionId: string) {
  return prisma.delegation.findMany({
    where: { editionId },
    include: {
      headParticipant: { select: { id: true, firstName: true, lastName: true } },
      referent: { select: { id: true, name: true, email: true, phone: true, role: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function findDelegationById(id: string) {
  return prisma.delegation.findUnique({
    where: { id },
    include: {
      headParticipant: { select: { id: true, firstName: true, lastName: true } },
      referent: { select: { id: true, name: true, email: true, phone: true, role: true } },
      members: {
        select: { id: true, publicId: true, firstName: true, lastName: true, status: true },
        orderBy: { lastName: "asc" },
      },
    },
  });
}

export async function createDelegation(data: Prisma.DelegationCreateInput) {
  return prisma.delegation.create({ data });
}

export async function updateDelegation(id: string, data: Prisma.DelegationUpdateInput) {
  return prisma.delegation.update({ where: { id }, data });
}
