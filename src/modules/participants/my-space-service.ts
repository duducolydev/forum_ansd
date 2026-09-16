import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { jobQueue } from "@/lib/queue";

/** Modifications autorisées au participant lui-même (ni catégorie, ni statut, ni consentements). */
export const mySpaceInputSchema = z.object({
  civility: z.string().trim().max(20).optional().or(z.literal("")),
  firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
  lastName: z.string().trim().min(1, "Le nom est requis").max(100),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  organization: z.string().trim().max(200).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  dietaryRequirements: z.string().trim().max(300).optional().or(z.literal("")),
  specialNeeds: z.string().trim().max(300).optional().or(z.literal("")),
});

export type MySpaceInput = z.infer<typeof mySpaceInputSchema>;

/** Les informations restent modifiables jusqu'à J-3 (brief §5.3). */
export const EDIT_CUTOFF_DAYS = 3;

export function editDeadline(editionStart: Date): Date {
  return new Date(editionStart.getTime() - EDIT_CUTOFF_DAYS * 24 * 60 * 60 * 1000);
}

export function canEditNow(editionStart: Date, now: Date = new Date()): boolean {
  return now.getTime() < editDeadline(editionStart).getTime();
}

export async function getMySpaceData(participantId: string) {
  return prisma.participant.findFirst({
    where: { id: participantId, deletedAt: null },
    include: {
      category: true,
      edition: true,
      badges: { orderBy: { version: "desc" } },
      delegation: {
        include: {
          members: {
            select: { id: true, firstName: true, lastName: true, status: true, publicId: true },
            orderBy: { lastName: "asc" },
          },
        },
      },
      sessionRegistrations: { include: { session: true }, orderBy: { registeredAt: "asc" } },
    },
  });
}

export async function updateMyInfo(participantId: string, input: MySpaceInput): Promise<void> {
  const participant = await prisma.participant.findFirstOrThrow({
    where: { id: participantId, deletedAt: null },
    include: { edition: true },
  });

  if (!canEditNow(participant.edition.startDate)) {
    throw new Error(
      "Les informations ne sont plus modifiables en ligne. Adressez-vous à l'accueil du Forum.",
    );
  }

  const updated = await prisma.participant.update({
    where: { id: participantId },
    data: {
      civility: input.civility || null,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      city: input.city || null,
      organization: input.organization || null,
      jobTitle: input.jobTitle || null,
      dietaryRequirements: input.dietaryRequirements || null,
      specialNeeds: input.specialNeeds || null,
    },
  });

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participantId,
    action: "participant.self_update",
    entity: "Participant",
    entityId: participantId,
    before: { firstName: participant.firstName, lastName: participant.lastName },
    after: { firstName: updated.firstName, lastName: updated.lastName },
  });
}

/**
 * Demande de suppression de compte (loi n° 2008-12 / RGPD, brief §7).
 * On enregistre la demande et on la met en file pour traitement par le comité :
 * l'anonymisation effective relève du Lot 3 (« anonymisation automatique »),
 * elle n'est donc volontairement pas exécutée ici.
 */
export async function requestAccountDeletion(participantId: string): Promise<void> {
  const participant = await prisma.participant.findFirstOrThrow({
    where: { id: participantId, deletedAt: null },
  });

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participantId,
    action: "participant.deletion_requested",
    entity: "Participant",
    entityId: participantId,
    after: { email: participant.email, requestedAt: new Date().toISOString() },
  });

  await jobQueue.enqueue(
    "participant.deletion_request",
    { participantId },
    { idempotencyKey: `deletion-request-${participantId}` },
  );
}
