import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { jobQueue } from "@/lib/queue";
import { nomDeFamille } from "@/lib/nom-de-famille";
import { enqueueBadgeRefresh, textesDuBadgeModifies } from "@/modules/badges/jobs";
import { BIOGRAPHIE_MAX, propagerBioDuParticipant } from "@/modules/speakers/biographie";

const texte = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Date d'un champ `<input type="date">`, ou vide. */
const dateSaisie = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
  .optional()
  .or(z.literal(""));

/**
 * Modifications autorisées au participant lui-même : tout ce qu'il a saisi à
 * l'inscription, sauf la catégorie, le statut, l'adresse e-mail (sa clé de
 * connexion) et les consentements.
 *
 * Le formulaire ne proposait que l'identité et deux champs de logistique (5
 * novembre 2026) : pays, profil professionnel, biographie, journées et
 * logistique ne se corrigeaient qu'en écrivant au comité. Les règles sont
 * celles de l'inscription (`registration-schema.ts`), pour qu'une valeur
 * acceptée là-bas le soit ici.
 */
export const mySpaceInputSchema = z
  .object({
    civility: texte(20),
    firstName: z.string().trim().min(1, "Le prénom est requis").max(100),
    lastName: z.string().trim().min(1, "Le nom est requis").max(100).transform(nomDeFamille),
    phone: texte(30),
    country: z.string().trim().min(1, "Le pays est requis").max(100),
    city: texte(100),
    organization: texte(200),
    organizationType: texte(100),
    jobTitle: texte(150),
    activityDomain: texte(150),
    website: texte(300),
    // Même plafond que la fiche intervenant, dont c'est aussi la biographie
    // (`speakers/biographie.ts`). L'inscription garde sa biographie courte.
    bio: z
      .string()
      .trim()
      .max(BIOGRAPHIE_MAX, `${BIOGRAPHIE_MAX} caractères maximum`)
      .optional()
      .or(z.literal("")),
    participationDays: z.array(z.string()).min(1, "Sélectionnez au moins une journée"),
    attendsOpening: z.boolean().default(false),
    attendsClosing: z.boolean().default(false),
    attendsAwards: z.boolean().default(false),
    arrivalDate: dateSaisie,
    departureDate: dateSaisie,
    needsAccommodation: z.boolean().default(false),
    needsTransport: z.boolean().default(false),
    dietaryRequirements: texte(300),
    specialNeeds: texte(300),
  })
  .refine(
    // Dates ISO : l'ordre alphabétique est l'ordre chronologique.
    (input) =>
      !input.arrivalDate || !input.departureDate || input.departureDate >= input.arrivalDate,
    { message: "La date de départ précède la date d'arrivée", path: ["departureDate"] },
  );

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
          // Référent interne (§28) : ses coordonnées sont montrées à **tous**
          // les membres, pas au seul chef de délégation — c'est lui qu'on
          // appelle quand on cherche une navette à six heures du matin.
          referent: { select: { name: true, email: true, phone: true, role: true } },
          members: {
            select: {
              id: true,
              civility: true,
              firstName: true,
              lastName: true,
              status: true,
              publicId: true,
            },
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
      country: input.country,
      city: input.city || null,
      organization: input.organization || null,
      organizationType: input.organizationType || null,
      jobTitle: input.jobTitle || null,
      activityDomain: input.activityDomain || null,
      website: input.website || null,
      bio: input.bio || null,
      participationDays: input.participationDays,
      attendsOpening: input.attendsOpening,
      attendsClosing: input.attendsClosing,
      attendsAwards: input.attendsAwards,
      // Même conversion qu'à l'inscription : minuit UTC du jour saisi.
      arrivalDate: input.arrivalDate ? new Date(input.arrivalDate) : null,
      departureDate: input.departureDate ? new Date(input.departureDate) : null,
      needsAccommodation: input.needsAccommodation,
      needsTransport: input.needsTransport,
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

  // Biographie corrigée : c'est aussi celle de sa fiche intervenant, s'il en a
  // une. Recopiée seulement si elle a changé (`speakers/biographie.ts`).
  if ((participant.bio ?? "") !== (updated.bio ?? "")) {
    await propagerBioDuParticipant(participantId, updated.bio);
  }

  // Nom, fonction ou organisation corrigés par la personne : son badge déjà
  // généré est refait, même QR, sans e-mail (29 octobre 2026).
  if (textesDuBadgeModifies(participant, updated)) {
    await enqueueBadgeRefresh(participantId, { silencieux: true });
  }
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
