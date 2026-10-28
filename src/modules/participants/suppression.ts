import type { InvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { enqueueNotification } from "@/modules/notifications/jobs";
import { annuler } from "@/modules/sessions/registration";
import type { Actor } from "./service";

/** Identifiant public tel que le génère `generateUniquePublicId` (ex. FID26-7K3M2P). */
const IDENTIFIANT_PUBLIC = /^[A-Z0-9]+-[A-Z0-9]+$/;

/**
 * Suppression **définitive** d'un participant et de tout ce qui le concerne
 * (demande du 28 octobre 2026) : d'abord pour retirer les comptes de test, ensuite
 * pour répondre à une demande d'effacement envoyée depuis « Mon espace ».
 *
 * L'ancienne suppression ne faisait que dater `deletedAt` : la fiche restait,
 * avec son adresse, et l'unicité (édition, e-mail) refusait toute nouvelle
 * inscription. Ici la ligne disparaît, et la personne peut se réinscrire avec
 * la même adresse.
 *
 * Effacés : la fiche, sa photo, ses badges et leurs fichiers (anciens gabarits
 * compris), ses réservations de session, ses passages aux points de contrôle,
 * l'historique de ses e-mails, ses liens de connexion et ses accès de zone.
 *
 * Conservés : le journal d'audit, qui trace la suppression elle-même ; une
 * fiche d'intervenant liée, simplement détachée ; la délégation qu'il dirigeait,
 * sans chef. Une invitation passée « inscrite » revient à son état d'avant,
 * pour que son lien serve de nouveau.
 */
export async function supprimerDefinitivement(participantId: string, actor: Actor): Promise<void> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      id: true,
      editionId: true,
      publicId: true,
      firstName: true,
      lastName: true,
      email: true,
      photoPath: true,
      invitation: { select: { id: true, status: true, sentAt: true, openedAt: true } },
      badges: { select: { pdfPath: true, pngPath: true } },
      sessionRegistrations: {
        where: { status: { in: ["REGISTERED", "ATTENDED", "WAITLISTED"] } },
        select: { sessionId: true },
      },
    },
  });
  if (!participant) throw new Error("Participant introuvable.");

  /*
   * Les places tenues sont rendues par la voie ordinaire, avant la suppression :
   * la première personne en liste d'attente est promue et prévenue. Supprimer
   * la ligne directement libérerait le siège sans faire avancer la liste.
   */
  for (const { sessionId } of participant.sessionRegistrations) {
    const { promu } = await annuler(sessionId, participant.id, {
      parPersonnel: true,
      actorUserId: actor.userId,
    });
    if (promu) {
      await enqueueNotification({
        editionId: participant.editionId,
        templateKey: "session_promoted",
        to: promu.email,
        participantId: promu.participantId,
        variables: { session: promu.sessionTitre },
      });
    }
  }

  const invitation = participant.invitation;
  await prisma.$transaction([
    // Les passages seraient sinon gardés, détachés : effacer, c'est aussi eux.
    prisma.scanLog.deleteMany({ where: { participantId } }),
    ...(invitation?.status === "REGISTERED"
      ? [
          prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: statutAvantInscription(invitation), respondedAt: null },
          }),
        ]
      : []),
    // Badges, réservations, e-mails, liens et accès de zone suivent en cascade.
    prisma.participant.delete({ where: { id: participantId } }),
  ]);

  /*
   * Fichiers après la base : si leur effacement échoue, il reste des fichiers
   * que plus rien ne désigne, et non une fiche qui désignerait des fichiers
   * disparus.
   */
  const fichiers = [
    participant.photoPath,
    ...participant.badges.flatMap((badge) => [badge.pdfPath, badge.pngPath]),
  ].filter((chemin): chemin is string => Boolean(chemin));
  await Promise.all(fichiers.map((chemin) => fileStorage.delete(chemin)));
  if (IDENTIFIANT_PUBLIC.test(participant.publicId)) {
    await fileStorage.deleteDirectory(`badges/${participant.publicId}`).catch(() => undefined);
  }

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    actorParticipantId: actor.participantId,
    action: "participant.purge",
    entity: "Participant",
    entityId: participantId,
    before: {
      publicId: participant.publicId,
      nom: `${participant.firstName} ${participant.lastName}`,
      email: participant.email,
    },
  });
}

/** L'étape atteinte avant l'inscription, telle que les dates permettent de la retrouver. */
function statutAvantInscription(invitation: {
  sentAt: Date | null;
  openedAt: Date | null;
}): InvitationStatus {
  if (invitation.openedAt) return "OPENED";
  if (invitation.sentAt) return "SENT";
  return "PENDING";
}
