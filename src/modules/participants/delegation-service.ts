import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { alerterDesignation } from "@/modules/referents/notifications";
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
    referent: input.referentId ? { connect: { id: input.referentId } } : undefined,
    maxMembers: input.maxMembers ?? null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "delegation.create",
    entity: "Delegation",
    entityId: delegation.id,
    after: { name: delegation.name, referentId: delegation.referentId },
  });

  // Après l'écriture, jamais pendant : un envoi qui échoue ne doit pas faire
  // perdre la délégation qu'on vient de créer.
  if (delegation.referentId) await alerterDesignation(delegation.id);

  return delegation;
}

export async function updateDelegation(id: string, input: DelegationInput, actor: Actor) {
  const before = await prisma.delegation.findUniqueOrThrow({ where: { id } });
  const referentId = input.referentId || null;
  const updated = await repo.updateDelegation(id, {
    name: input.name,
    country: input.country || null,
    institution: input.institution || null,
    referent: referentId ? { connect: { id: referentId } } : { disconnect: true },
    maxMembers: input.maxMembers ?? null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "delegation.update",
    entity: "Delegation",
    entityId: id,
    before: { name: before.name, referentId: before.referentId },
    after: { name: updated.name, referentId: updated.referentId },
  });

  /*
   * Alerte au seul **changement** de référent. Enregistrer le formulaire sans
   * y toucher ne doit pas renvoyer le message : le référent finirait par les
   * ignorer, et c'est précisément celui qui compte qu'il manquerait alors.
   */
  if (referentId && referentId !== before.referentId) await alerterDesignation(id);

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
