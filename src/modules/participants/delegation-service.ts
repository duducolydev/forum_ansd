import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import * as repo from "./repository";
import type { DelegationInput } from "./schema";
import type { Actor } from "./service";

/** Délégations (brief §2.7) : groupe de participants d'une même institution/pays. */
export async function createDelegation(editionId: string, input: DelegationInput, actor: Actor) {
  const delegation = await repo.createDelegation({
    edition: { connect: { id: editionId } },
    name: input.name,
    country: input.country || null,
    institution: input.institution || null,
    maxMembers: input.maxMembers ?? null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "delegation.create",
    entity: "Delegation",
    entityId: delegation.id,
    after: { name: delegation.name },
  });

  return delegation;
}

export async function updateDelegation(id: string, input: DelegationInput, actor: Actor) {
  const before = await prisma.delegation.findUniqueOrThrow({ where: { id } });
  const updated = await repo.updateDelegation(id, {
    name: input.name,
    country: input.country || null,
    institution: input.institution || null,
    maxMembers: input.maxMembers ?? null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "delegation.update",
    entity: "Delegation",
    entityId: id,
    before: { name: before.name },
    after: { name: updated.name },
  });

  return updated;
}

/** Désigne le chef de délégation (peut inscrire ses membres, brief §2.7). Doit déjà être membre. */
export async function setDelegationHead(delegationId: string, participantId: string, actor: Actor) {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  if (participant.delegationId !== delegationId) {
    throw new Error("Le chef de délégation doit d'abord être membre de la délégation.");
  }

  const updated = await repo.updateDelegation(delegationId, {
    headParticipant: { connect: { id: participantId } },
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "delegation.set_head",
    entity: "Delegation",
    entityId: delegationId,
    after: { headParticipantId: participantId },
  });

  return updated;
}

export async function listDelegations(editionId: string) {
  return repo.listDelegations(editionId);
}

export async function getDelegation(id: string) {
  return repo.findDelegationById(id);
}
