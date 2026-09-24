import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Accès base de l'annuaire des référents (§28).
 *
 * Le service au-dessus ne connaît pas Prisma : c'est la règle du dépôt pour
 * les modules à part entière, et c'est ce qui rend le service testable sans
 * base.
 */

/** Champs exposés partout où un référent est présenté à un participant. */
export const CHAMPS_PUBLICS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
} as const;

export async function listReferents(editionId: string) {
  return prisma.referent.findMany({
    where: { editionId },
    include: { _count: { select: { delegations: true } } },
    // Les référents en service d'abord : ce sont les seuls qu'on rattache.
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

/** Référents rattachables : le formulaire d'une délégation ne propose qu'eux. */
export async function listReferentsActifs(editionId: string) {
  return prisma.referent.findMany({
    where: { editionId, isActive: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function findReferentById(id: string) {
  return prisma.referent.findUnique({
    where: { id },
    include: {
      delegations: {
        select: { id: true, name: true, _count: { select: { members: true } } },
        orderBy: { name: "asc" },
      },
    },
  });
}

export async function createReferent(data: Prisma.ReferentCreateInput) {
  return prisma.referent.create({ data });
}

export async function updateReferent(id: string, data: Prisma.ReferentUpdateInput) {
  return prisma.referent.update({ where: { id }, data });
}

export async function deleteReferent(id: string) {
  return prisma.referent.delete({ where: { id } });
}

/** Nombre de délégations rattachées : décide si la suppression est permise. */
export async function compterDelegations(referentId: string) {
  return prisma.delegation.count({ where: { referentId } });
}
