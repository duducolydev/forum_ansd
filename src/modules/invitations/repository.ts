import type { InvitationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const INVITATION_LIST_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  organization: true,
  country: true,
  status: true,
  sentAt: true,
  remindersCount: true,
  openedAt: true,
  createdAt: true,
  category: { select: { id: true, labelFr: true } },
} satisfies Prisma.InvitationSelect;

export type InvitationListItem = Prisma.InvitationGetPayload<{
  select: typeof INVITATION_LIST_SELECT;
}>;

export interface InvitationListFilters {
  editionId: string;
  q?: string;
  status?: InvitationStatus;
  categoryId?: string;
  page: number;
  pageSize: number;
}

function buildWhere(filters: InvitationListFilters): Prisma.InvitationWhereInput {
  return {
    editionId: filters.editionId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.q
      ? {
          OR: [
            { firstName: { contains: filters.q } },
            { lastName: { contains: filters.q } },
            { email: { contains: filters.q } },
            { organization: { contains: filters.q } },
          ],
        }
      : {}),
  };
}

export async function listInvitations(
  filters: InvitationListFilters,
): Promise<{ items: InvitationListItem[]; total: number }> {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.invitation.findMany({
      where,
      select: INVITATION_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.invitation.count({ where }),
  ]);
  return { items, total };
}

export async function findInvitationById(id: string) {
  return prisma.invitation.findUnique({ where: { id }, include: { category: true } });
}

export async function findInvitationByToken(token: string) {
  return prisma.invitation.findUnique({ where: { token }, include: { category: true } });
}

export async function findInvitationByEmail(editionId: string, email: string) {
  return prisma.invitation.findFirst({ where: { editionId, email: email.toLowerCase() } });
}

/** Invitation non liée à un participant, envoyée mais pas encore inscrite (brief §5.5 rapprochement). */
export async function findReconcilableInvitation(editionId: string, email: string) {
  return prisma.invitation.findFirst({
    where: {
      editionId,
      email: email.toLowerCase(),
      participant: { is: null },
      status: { in: ["PENDING", "SENT", "OPENED", "CLICKED"] },
    },
  });
}

export async function createInvitation(data: Prisma.InvitationCreateInput) {
  return prisma.invitation.create({ data });
}

export async function createManyInvitations(data: Prisma.InvitationCreateManyInput[]) {
  return prisma.invitation.createMany({ data, skipDuplicates: true });
}

export async function updateInvitation(id: string, data: Prisma.InvitationUpdateInput) {
  return prisma.invitation.update({ where: { id }, data });
}

export async function listRemindableInvitations(
  editionId: string,
  filters: { categoryId?: string; country?: string },
  maxReminders: number,
) {
  return prisma.invitation.findMany({
    where: {
      editionId,
      status: { in: ["SENT", "OPENED", "CLICKED"] },
      remindersCount: { lt: maxReminders },
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.country ? { country: filters.country } : {}),
    },
  });
}

export async function existingEmailsForEdition(
  editionId: string,
  emails: string[],
): Promise<Set<string>> {
  const [invitations, participants] = await Promise.all([
    prisma.invitation.findMany({
      where: { editionId, email: { in: emails } },
      select: { email: true },
    }),
    prisma.participant.findMany({
      where: { editionId, email: { in: emails } },
      select: { email: true },
    }),
  ]);
  return new Set([...invitations, ...participants].map((row) => row.email.toLowerCase()));
}
