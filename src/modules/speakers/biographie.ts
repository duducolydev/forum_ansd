import { prisma } from "@/lib/db";

/**
 * Une seule biographie pour une même personne (5 novembre 2026).
 *
 * Un participant désigné intervenant a deux fiches : `Participant.bio`, qu'il
 * tient dans « Mon espace », et `Speaker.bioFr`, publiée sur le site et tenue
 * dans l'espace intervenant ou par le comité. Elles divergeaient : corrigée
 * d'un côté, la biographie restait périmée de l'autre.
 *
 * Plutôt qu'une colonne commune (migration lourde, et une fiche intervenant
 * peut exister sans participant), chaque écriture **qui change** la
 * biographie la recopie sur la fiche liée. « Qui change » importe : un
 * participant qui ne corrige que son téléphone ne doit pas écraser, avec la
 * biographie courte de son inscription, celle que le comité a rédigée pour le
 * programme.
 *
 * La biographie française est la seule commune : le participant n'en saisit
 * qu'une, les versions anglaise et portugaise restent propres à la fiche
 * intervenant.
 */

export { BIOGRAPHIE_MAX } from "./constantes";

const vide = (texte: string | null | undefined) => !texte?.trim();

/** Biographie modifiée par le participant : recopiée sur sa fiche intervenant. */
export async function propagerBioDuParticipant(
  participantId: string,
  bio: string | null,
): Promise<void> {
  await prisma.speaker.updateMany({ where: { participantId }, data: { bioFr: bio } });
}

/** Biographie modifiée sur la fiche intervenant : recopiée sur le participant lié. */
export async function propagerBioDeLIntervenant(
  speakerId: string,
  bio: string | null,
): Promise<void> {
  const speaker = await prisma.speaker.findUnique({
    where: { id: speakerId },
    select: { participantId: true },
  });
  if (!speaker?.participantId) return;
  await prisma.participant.update({ where: { id: speaker.participantId }, data: { bio } });
}

/**
 * Au moment où une fiche intervenant et un participant sont reliés : le côté
 * vide reprend la biographie de l'autre. Deux biographies déjà rédigées ne
 * sont pas départagées ici — aucune règle ne dit laquelle est la bonne ; la
 * prochaine modification, d'un côté ou de l'autre, les alignera.
 */
export async function alignerBiographies(speakerId: string): Promise<void> {
  const speaker = await prisma.speaker.findUnique({
    where: { id: speakerId },
    select: { bioFr: true, participant: { select: { id: true, bio: true } } },
  });
  const participant = speaker?.participant;
  if (!speaker || !participant) return;

  if (vide(speaker.bioFr) && !vide(participant.bio)) {
    await prisma.speaker.update({ where: { id: speakerId }, data: { bioFr: participant.bio } });
  } else if (vide(participant.bio) && !vide(speaker.bioFr)) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: { bio: speaker.bioFr },
    });
  }
}
