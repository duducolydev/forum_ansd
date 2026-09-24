import { prisma } from "@/lib/db";
import { enqueueNotification } from "@/modules/notifications/jobs";

/**
 * Alertes envoyées au référent d'une délégation (§28).
 *
 * Deux moments, décidés avec le commanditaire : sa désignation, avec la
 * composition déjà connue, puis chaque membre ajouté ensuite. Le référent suit
 * ainsi sa délégation sans avoir à venir regarder, ce qu'il ne peut pas faire
 * de toute façon — il n'a pas de compte BackOffice.
 *
 * Les messages partent en français : le référent est un membre du comité
 * d'organisation de l'ANSD, pas un participant international.
 */

/** Composition lisible d'une délégation, une ligne par membre. */
function listeDesMembres(
  membres: { firstName: string; lastName: string; email: string }[],
): string {
  if (membres.length === 0) return "Aucun membre inscrit pour l'instant.";
  return membres.map((m) => `  ${m.firstName} ${m.lastName} — ${m.email}`).join("\n");
}

async function chargerDelegation(delegationId: string) {
  return prisma.delegation.findUnique({
    where: { id: delegationId },
    include: {
      referent: true,
      members: {
        select: { firstName: true, lastName: true, email: true },
        orderBy: { lastName: "asc" },
      },
    },
  });
}

/**
 * Le référent vient d'être rattaché à une délégation.
 *
 * La clé d'idempotence porte la paire délégation/référent : rouvrir le
 * formulaire et l'enregistrer sans rien changer ne renvoie pas le message.
 */
export async function alerterDesignation(delegationId: string): Promise<void> {
  const delegation = await chargerDelegation(delegationId);
  if (!delegation?.referent || !delegation.referent.isActive) return;

  await enqueueNotification(
    {
      editionId: delegation.editionId,
      templateKey: "delegation_referent_assigned",
      to: delegation.referent.email,
      variables: {
        referent_nom: delegation.referent.name,
        delegation_nom: delegation.name,
        delegation_pays: delegation.country ?? "—",
        effectif: String(delegation.members.length),
        liste_membres: listeDesMembres(delegation.members),
      },
    },
    `referent-designe:${delegationId}:${delegation.referentId}`,
  );
}

/**
 * Un participant vient de rejoindre une délégation qui a un référent.
 *
 * Appelée après l'écriture, jamais pendant : un envoi qui échoue ne doit pas
 * empêcher le rattachement, qui est l'acte utile.
 */
export async function alerterNouveauMembre(
  delegationId: string,
  participantId: string,
): Promise<void> {
  const delegation = await chargerDelegation(delegationId);
  if (!delegation?.referent || !delegation.referent.isActive) return;

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { firstName: true, lastName: true, email: true, organization: true },
  });
  if (!participant) return;

  await enqueueNotification(
    {
      editionId: delegation.editionId,
      templateKey: "delegation_member_added",
      to: delegation.referent.email,
      variables: {
        referent_nom: delegation.referent.name,
        delegation_nom: delegation.name,
        membre_nom: `${participant.firstName} ${participant.lastName}`,
        membre_email: participant.email,
        membre_organisation: participant.organization ?? "—",
        effectif: String(delegation.members.length),
      },
    },
    // Un même participant n'entre qu'une fois dans une délégation donnée.
    `referent-membre:${delegationId}:${participantId}`,
  );
}
