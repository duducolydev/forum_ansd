import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";
import {
  ajouterPresentationASession,
  relierPresentationIntervenant,
  retirerPresentationDeSession,
  retirerPresentationsDuSite,
} from "@/modules/contributions/service";
import {
  PHOTO_MAX_BYTES,
  PRESENTATION_MAX_BYTES,
  ROLES_SESSION,
  STATUTS_CONFIRMATION,
  type RoleSession,
  type StatutConfirmation,
} from "./constantes";

/**
 * Intervenants (brief §5.8).
 *
 * Deux écritures possibles : par le comité, depuis le BackOffice, et par
 * l'intervenant lui-même, depuis son espace. Les deux passent par ce service,
 * mais **pas par les mêmes fonctions** : un intervenant ne modifie que sa
 * présentation de lui-même, jamais son rattachement aux sessions ni sa
 * publication.
 */

export interface Actor {
  type: "USER" | "PARTICIPANT" | "SYSTEM";
  userId?: string;
}

export class SpeakerRuleError extends Error {}

export { PHOTO_MAX_BYTES, PRESENTATION_MAX_BYTES };

export const speakerInputSchema = z.object({
  firstName: z.string().trim().min(2, "Le prénom est requis").max(80),
  lastName: z.string().trim().min(2, "Le nom est requis").max(80),
  email: z.email("Adresse e-mail invalide").optional().or(z.literal("")),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  organization: z.string().trim().max(150).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  bioFr: z.string().trim().max(3000).optional().or(z.literal("")),
  bioEn: z.string().trim().max(3000).optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
});

export type SpeakerInput = z.infer<typeof speakerInputSchema>;

/** Ce qu'un intervenant peut modifier lui-même. */
export const selfEditSchema = z.object({
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
  organization: z.string().trim().max(150).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  bioFr: z.string().trim().max(3000).optional().or(z.literal("")),
  bioEn: z.string().trim().max(3000).optional().or(z.literal("")),
});

export type SelfEditInput = z.infer<typeof selfEditSchema>;

const SELECTION = {
  id: true,
  editionId: true,
  email: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  organization: true,
  country: true,
  photoPath: true,
  presentationPath: true,
  presentationConsentement: true,
  bioFr: true,
  bioEn: true,
  isPublished: true,
  participant: { select: { id: true, publicId: true, email: true, status: true } },
  sessions: {
    // Une session supprimée (suppression douce) ne compte plus au programme.
    where: { session: { deletedAt: null } },
    orderBy: { session: { startTime: "asc" } },
    select: {
      role: true,
      confirmationStatus: true,
      session: {
        select: { id: true, slug: true, titleFr: true, day: true, startTime: true, endTime: true },
      },
    },
  },
} as const;

export async function listSpeakers(editionId: string) {
  return prisma.speaker.findMany({
    where: { editionId, deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: SELECTION,
  });
}

export async function getSpeaker(id: string) {
  return prisma.speaker.findFirst({ where: { id, deletedAt: null }, select: SELECTION });
}

export async function createSpeaker(editionId: string, input: SpeakerInput, actor: Actor) {
  const speaker = await prisma.speaker.create({
    data: {
      editionId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ? input.email.toLowerCase() : null,
      jobTitle: input.jobTitle || null,
      organization: input.organization || null,
      country: input.country || null,
      bioFr: input.bioFr || null,
      bioEn: input.bioEn || null,
      isPublished: input.isPublished,
    },
    select: SELECTION,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "speaker.create",
    entity: "Speaker",
    entityId: speaker.id,
    after: { nom: `${speaker.firstName} ${speaker.lastName}` },
  });

  return speaker;
}

export async function updateSpeaker(id: string, input: SpeakerInput, actor: Actor) {
  const speaker = await prisma.speaker.update({
    where: { id },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email ? input.email.toLowerCase() : null,
      jobTitle: input.jobTitle || null,
      organization: input.organization || null,
      country: input.country || null,
      bioFr: input.bioFr || null,
      bioEn: input.bioEn || null,
      isPublished: input.isPublished,
    },
    select: SELECTION,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "speaker.update",
    entity: "Speaker",
    entityId: id,
    after: { isPublished: speaker.isPublished },
  });

  return speaker;
}

/** Mise à jour par l'intervenant lui-même : bio et coordonnées, rien d'autre. */
export async function updateSelf(speakerId: string, input: SelfEditInput) {
  await prisma.speaker.update({
    where: { id: speakerId },
    data: {
      jobTitle: input.jobTitle || null,
      organization: input.organization || null,
      country: input.country || null,
      bioFr: input.bioFr || null,
      bioEn: input.bioEn || null,
    },
  });

  await audit.log({
    actorType: "SYSTEM",
    action: "speaker.self_update",
    entity: "Speaker",
    entityId: speakerId,
  });
}

export async function saveSpeakerPhoto(speakerId: string, file: File): Promise<void> {
  if (file.size > PHOTO_MAX_BYTES) {
    throw new SpeakerRuleError(`Photo trop lourde (maximum ${PHOTO_MAX_BYTES / 1024 / 1024} Mo).`);
  }

  const octets = Buffer.from(await file.arrayBuffer());
  // Type déduit des octets, jamais de l'extension : la photo est publiée sur
  // le site, un fichier renommé ne doit pas s'y retrouver.
  const detecte = detectImageType(octets);
  if (!detecte) {
    throw new SpeakerRuleError("Format d'image non reconnu (JPEG, PNG ou WebP).");
  }

  const ancien = await prisma.speaker.findUniqueOrThrow({
    where: { id: speakerId },
    select: { photoPath: true },
  });

  const chemin = `speakers/${speakerId}-${randomBytes(6).toString("hex")}.${detecte.extension}`;
  await fileStorage.put(chemin, octets, detecte.type);
  await prisma.speaker.update({ where: { id: speakerId }, data: { photoPath: chemin } });

  if (ancien.photoPath && ancien.photoPath !== chemin) {
    await fileStorage.delete(ancien.photoPath).catch(() => undefined);
  }

  await audit.log({
    actorType: "SYSTEM",
    action: "speaker.photo_updated",
    entity: "Speaker",
    entityId: speakerId,
    after: { bytes: octets.length },
  });
}

/**
 * Enregistre la présentation d'un intervenant, puis la relie aux contributions
 * de ses sessions (§15).
 *
 * Reçoit des octets et non un `File` : l'appel vient d'une route. Il passait
 * par une Server Action, qui refuse sans un mot tout envoi de plus de 3 Mo
 * (§13.7) — l'intervenant dont le PDF dépassait ce seuil ne voyait rien, alors
 * que le plafond annoncé était de 20 Mo.
 */
export async function savePresentation(
  speakerId: string,
  octets: Buffer,
): Promise<{ sessionsReliees: number }> {
  if (octets.length === 0) throw new SpeakerRuleError("Aucun fichier reçu.");
  if (octets.length > PRESENTATION_MAX_BYTES) {
    throw new SpeakerRuleError(
      `Fichier trop lourd (maximum ${PRESENTATION_MAX_BYTES / 1024 / 1024} Mo).`,
    );
  }

  if (octets.subarray(0, 4).toString("ascii") !== "%PDF") {
    // PDF seulement : un support de présentation doit s'ouvrir partout, y
    // compris sur la machine de la régie le jour J.
    throw new SpeakerRuleError("Seuls les fichiers PDF sont acceptés.");
  }

  const ancien = await prisma.speaker.findUniqueOrThrow({
    where: { id: speakerId },
    select: { presentationPath: true },
  });

  const chemin = `presentations/${speakerId}-${randomBytes(6).toString("hex")}.pdf`;
  await fileStorage.put(chemin, octets, "application/pdf");
  await prisma.speaker.update({ where: { id: speakerId }, data: { presentationPath: chemin } });

  if (ancien.presentationPath && ancien.presentationPath !== chemin) {
    await fileStorage.delete(ancien.presentationPath).catch(() => undefined);
  }

  await audit.log({
    actorType: "SYSTEM",
    action: "speaker.presentation_updated",
    entity: "Speaker",
    entityId: speakerId,
    after: { bytes: octets.length },
  });

  return { sessionsReliees: await relierPresentationIntervenant(speakerId, octets) };
}

/**
 * Accord de l'intervenant pour la publication de sa présentation (§15).
 *
 * Sans lui, le comité ne peut pas mettre en ligne la contribution issue du
 * dépôt. Le retirer retire aussi du site ce qui y figurait déjà.
 */
export async function definirConsentementPresentation(
  speakerId: string,
  accord: boolean,
): Promise<void> {
  await prisma.speaker.update({
    where: { id: speakerId },
    data: { presentationConsentement: accord },
  });
  if (!accord) await retirerPresentationsDuSite(speakerId);

  await audit.log({
    actorType: "SYSTEM",
    action: accord
      ? "speaker.presentation_consent_given"
      : "speaker.presentation_consent_withdrawn",
    entity: "Speaker",
    entityId: speakerId,
  });
}

// ---------------------------------------------------------------------------
// Rattachement aux sessions (brief §5.8, PLAN.md §15.9)
// ---------------------------------------------------------------------------

function estRole(valeur: string): valeur is RoleSession {
  return Object.prototype.hasOwnProperty.call(ROLES_SESSION, valeur);
}

function estStatut(valeur: string): valeur is StatutConfirmation {
  return Object.prototype.hasOwnProperty.call(STATUTS_CONFIRMATION, valeur);
}

/** Sessions proposées au rattachement : celles de l'édition, hors supprimées. */
export async function sessionsPourRattachement(editionId: string) {
  return prisma.session.findMany({
    where: { editionId, deletedAt: null },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
    select: { id: true, titleFr: true, startTime: true },
  });
}

/**
 * Intervenant et session, vérifiés ensemble : la session doit appartenir à
 * l'édition de l'intervenant. Un identifiant de session d'une autre édition,
 * glissé dans la requête, ne doit rien rattacher.
 */
async function trouverRattachable(speakerId: string, sessionId: string) {
  const speaker = await prisma.speaker.findFirst({
    where: { id: speakerId, deletedAt: null },
    select: { id: true, editionId: true },
  });
  if (!speaker) throw new SpeakerRuleError("Intervenant introuvable.");

  const session = await prisma.session.findFirst({
    where: { id: sessionId, editionId: speaker.editionId, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!session) throw new SpeakerRuleError("Session introuvable.");

  return { speaker, session };
}

/**
 * Rattache un intervenant à une session.
 *
 * S'il a déjà déposé sa présentation, elle rejoint la session comme contribution
 * en brouillon : sans cela, un dépôt fait avant le rattachement restait
 * invisible pour le comité (§15.9).
 */
export async function rattacherSession(
  speakerId: string,
  sessionId: string,
  role: string,
  actor: Actor,
): Promise<{ slug: string; presentationAjoutee: boolean }> {
  if (!estRole(role)) throw new SpeakerRuleError("Rôle inconnu.");
  const { session } = await trouverRattachable(speakerId, sessionId);

  const existant = await prisma.sessionSpeaker.findUnique({
    where: { sessionId_speakerId: { sessionId, speakerId } },
    select: { id: true },
  });
  if (existant) throw new SpeakerRuleError("Cet intervenant figure déjà dans cette session.");

  const dernier = await prisma.sessionSpeaker.aggregate({
    where: { sessionId },
    _max: { sortOrder: true },
  });
  // Statut initial laissé au défaut du schéma, PRESSENTI : le parcours de
  // confirmation commence au rattachement (brief §3).
  await prisma.sessionSpeaker.create({
    data: { sessionId, speakerId, role, sortOrder: (dernier._max.sortOrder ?? 0) + 1 },
  });

  const presentationAjoutee = await ajouterPresentationASession(speakerId, sessionId);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "speaker.session_attached",
    entity: "Speaker",
    entityId: speakerId,
    after: { sessionId, role, presentationAjoutee },
  });

  return { slug: session.slug, presentationAjoutee };
}

export async function modifierRattachement(
  speakerId: string,
  sessionId: string,
  role: string,
  statut: string,
  actor: Actor,
): Promise<{ slug: string }> {
  if (!estRole(role)) throw new SpeakerRuleError("Rôle inconnu.");
  if (!estStatut(statut)) throw new SpeakerRuleError("Statut de confirmation inconnu.");
  const { session } = await trouverRattachable(speakerId, sessionId);

  const { count } = await prisma.sessionSpeaker.updateMany({
    where: { sessionId, speakerId },
    data: { role, confirmationStatus: statut },
  });
  if (count === 0) {
    throw new SpeakerRuleError("Cet intervenant ne figure pas dans cette session.");
  }

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "speaker.session_updated",
    entity: "Speaker",
    entityId: speakerId,
    after: { sessionId, role, confirmationStatus: statut },
  });

  return { slug: session.slug };
}

/**
 * Retire un intervenant d'une session.
 *
 * Sa présentation en sort si elle n'y est qu'en brouillon ; en ligne, elle
 * reste, et le message le dit (voir `retirerPresentationDeSession`).
 */
export async function retirerSession(
  speakerId: string,
  sessionId: string,
  actor: Actor,
): Promise<{ slug: string; presentation: "retiree" | "conservee" | "aucune" }> {
  const { session } = await trouverRattachable(speakerId, sessionId);

  const { count } = await prisma.sessionSpeaker.deleteMany({ where: { sessionId, speakerId } });
  if (count === 0) return { slug: session.slug, presentation: "aucune" };

  const presentation = await retirerPresentationDeSession(speakerId, sessionId);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "speaker.session_detached",
    entity: "Speaker",
    entityId: speakerId,
    before: { sessionId },
    after: { presentation },
  });

  return { slug: session.slug, presentation };
}

/**
 * Crée le participant correspondant à un intervenant (brief §5.8).
 *
 * Un intervenant a besoin d'un badge et compte dans les présences ; mais tous
 * n'ont pas vocation à être inscrits, d'où un bouton explicite plutôt qu'une
 * création automatique. Le participant est créé **confirmé** : le comité a déjà
 * validé la personne en la mettant au programme.
 */
export async function createParticipantFromSpeaker(
  editionId: string,
  editionCode: string,
  speakerId: string,
  categoryId: string,
  actor: Actor,
) {
  const speaker = await prisma.speaker.findFirstOrThrow({
    where: { id: speakerId, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      organization: true,
      country: true,
      participantId: true,
    },
  });

  if (speaker.participantId) {
    throw new SpeakerRuleError("Cet intervenant est déjà rattaché à un participant.");
  }
  if (!speaker.email) {
    throw new SpeakerRuleError(
      "Renseignez d'abord une adresse e-mail : un participant ne peut pas exister sans.",
    );
  }

  const existant = await prisma.participant.findUnique({
    where: { editionId_email: { editionId, email: speaker.email } },
    select: { id: true },
  });

  const participant =
    existant ??
    (await prisma.participant.create({
      data: {
        editionId,
        publicId: `${editionCode
          .replace(/[^A-Z0-9]/gi, "")
          .slice(0, 5)
          .toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
        firstName: speaker.firstName,
        lastName: speaker.lastName,
        email: speaker.email,
        country: speaker.country ?? "Sénégal",
        jobTitle: speaker.jobTitle,
        organization: speaker.organization,
        categoryId,
        status: "CONFIRMED",
        source: "IMPORT",
        confirmedAt: new Date(),
        confirmedById: actor.userId,
      },
      select: { id: true },
    }));

  await prisma.speaker.update({
    where: { id: speakerId },
    data: { participantId: participant.id },
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: existant ? "speaker.linked_participant" : "speaker.created_participant",
    entity: "Speaker",
    entityId: speakerId,
    after: { participantId: participant.id, reutilise: existant !== null },
  });

  return participant.id;
}
