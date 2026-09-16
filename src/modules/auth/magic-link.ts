import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueNotification } from "@/modules/notifications/jobs";

const LINK_TTL_MINUTES = 30;
const REQUEST_LIMIT = 3;
const REQUEST_WINDOW_SECONDS = 60;
/** Le code à 6 chiffres est court : sans limite, il serait cassable par force brute. */
const VERIFY_LIMIT = 5;
const VERIFY_WINDOW_SECONDS = 60;

/*
 * Force brute du code à 6 chiffres (PLAN.md §18).
 *
 * Les limites par minute ne suffisaient pas. Chaque demande créait un code valable
 * 30 minutes **sans annuler les précédents** : à 3 demandes par minute, environ
 * 90 codes étaient valides en même temps, et chaque essai avait 90 chances sur un
 * million de tomber juste. À 5 essais par minute, cela faisait environ 2,7 % de
 * réussite par heure et près d'une chance sur deux par jour sur un participant
 * visé — donc son espace, ses données et son badge.
 *
 * Trois règles ramènent ce risque à un niveau négligeable :
 *
 * - **un seul code valide à la fois** : une nouvelle demande annule les liens
 *   non utilisés du même compte ;
 * - **5 codes erronés annulent le lien** : il faut en redemander un ;
 * - **10 demandes par jour au plus** par adresse.
 *
 * Soit au plus 50 essais par jour, chacun contre un seul code : environ
 * 0,005 % de réussite par jour.
 */
const MAX_ECHECS_CODE = 5;
const DEMANDES_PAR_JOUR = 10;
const UN_JOUR_EN_SECONDES = 24 * 60 * 60;

/** Limites de demande de lien : par minute, puis par jour. */
async function limiterDemandes(
  cle: string,
): Promise<{ status: "RATE_LIMITED"; retryAfterSeconds: number } | null> {
  const minute = await rateLimit(`${cle}`, REQUEST_LIMIT, REQUEST_WINDOW_SECONDS);
  if (!minute.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: minute.retryAfterSeconds };
  }
  const jour = await rateLimit(`${cle}:jour`, DEMANDES_PAR_JOUR, UN_JOUR_EN_SECONDES);
  if (!jour.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: jour.retryAfterSeconds };
  }
  return null;
}

/**
 * Consomme un lien **atomiquement** : relire puis écrire laissait deux requêtes
 * simultanées utiliser le même lien. Vrai seulement pour celle qui l'a marqué.
 */
async function marquerUtilise(lienId: string): Promise<boolean> {
  const { count } = await prisma.magicLink.updateMany({
    where: { id: lienId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

function codesEgaux(attendu: string, saisi: string): boolean {
  const a = Buffer.from(attendu);
  const b = Buffer.from(saisi);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type MagicLinkRequestResult =
  { status: "SENT" } | { status: "RATE_LIMITED"; retryAfterSeconds: number };

export type MagicLinkConsumeResult =
  | { status: "OK"; participantId: string }
  | { status: "INVALID" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Demande d'accès à l'espace participant (brief §5.3).
 * Renvoie toujours `SENT` lorsqu'aucun participant ne correspond : sinon le
 * formulaire deviendrait un oracle permettant d'énumérer les e-mails inscrits.
 */
export async function requestMagicLink(
  editionId: string,
  email: string,
  ip: string,
): Promise<MagicLinkRequestResult> {
  const normalisedEmail = email.trim().toLowerCase();

  const limite = await limiterDemandes(`magic-link:${normalisedEmail}`);
  if (limite) return limite;

  const participant = await prisma.participant.findUnique({
    where: { editionId_email: { editionId, email: normalisedEmail } },
  });

  if (!participant || participant.deletedAt) {
    return { status: "SENT" };
  }

  const token = randomBytes(32).toString("base64url");
  const code6 = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000);

  // Un seul code valide à la fois : le dernier envoyé.
  await prisma.magicLink.updateMany({
    where: { participantId: participant.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.magicLink.create({
    data: { participantId: participant.id, tokenHash: hashToken(token), code6, expiresAt },
  });

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  await enqueueNotification({
    editionId,
    templateKey: "magic_link",
    to: participant.email,
    participantId: participant.id,
    variables: {
      prenom: participant.firstName,
      lien_connexion: `${baseUrl}/mon-espace/lien/${token}`,
      code6,
    },
  });

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participant.id,
    action: "magic_link.requested",
    entity: "Participant",
    entityId: participant.id,
    ip,
  });

  return { status: "SENT" };
}

/** Consommation du lien : le jeton est à usage unique. */
export async function consumeMagicLink(token: string): Promise<MagicLinkConsumeResult> {
  const magicLink = await prisma.magicLink.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!magicLink || magicLink.usedAt || magicLink.expiresAt.getTime() < Date.now()) {
    return { status: "INVALID" };
  }

  /*
   * Un jeton d'intervenant est refusé ici, et réciproquement plus bas.
   *
   * Les deux types de liens vivent dans la même table ; sans ce contrôle, un
   * lien d'intervenant ouvrirait un espace participant — sur un identifiant
   * nul, donc au mieux une erreur, au pire l'espace de quelqu'un d'autre. Le
   * typage a signalé le trou au moment d'ajouter les intervenants ; ce garde-fou
   * le referme explicitement.
   */
  if (magicLink.participantId === null) {
    return { status: "INVALID" };
  }
  const participantId = magicLink.participantId;

  if (!(await marquerUtilise(magicLink.id))) return { status: "INVALID" };

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participantId,
    action: "magic_link.consumed",
    entity: "Participant",
    entityId: participantId,
  });

  return { status: "OK", participantId };
}

/** Repli : saisie du code à 6 chiffres reçu par e-mail. */
export async function consumeCode(
  editionId: string,
  email: string,
  code6: string,
): Promise<MagicLinkConsumeResult> {
  const normalisedEmail = email.trim().toLowerCase();

  const limit = await rateLimit(
    `magic-code:${normalisedEmail}`,
    VERIFY_LIMIT,
    VERIFY_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds };
  }

  const participant = await prisma.participant.findUnique({
    where: { editionId_email: { editionId, email: normalisedEmail } },
  });
  if (!participant || participant.deletedAt) return { status: "INVALID" };

  /*
   * Seul le **dernier** lien encore valide est comparé. La recherche portait
   * auparavant sur le code parmi tous les liens valides, ce qui multipliait les
   * chances d'un essai au hasard ; les liens d'avant cette règle restent en base
   * mais ne sont plus jamais comparés.
   */
  const magicLink = await prisma.magicLink.findFirst({
    where: { participantId: participant.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!magicLink) return { status: "INVALID" };

  if (!codesEgaux(magicLink.code6, code6)) {
    const apres = await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { failedAttempts: { increment: 1 } },
    });
    if (apres.failedAttempts >= MAX_ECHECS_CODE) {
      // Lien annulé : le prochain essai demande un nouvel envoi.
      await marquerUtilise(magicLink.id);
    }
    return { status: "INVALID" };
  }

  if (!(await marquerUtilise(magicLink.id))) return { status: "INVALID" };

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participant.id,
    action: "magic_link.code_consumed",
    entity: "Participant",
    entityId: participant.id,
  });

  return { status: "OK", participantId: participant.id };
}

// ---------------------------------------------------------------------------
// Intervenants (brief §5.8, contradiction C12)
// ---------------------------------------------------------------------------

export type SpeakerLinkConsumeResult =
  | { status: "OK"; speakerId: string }
  | { status: "INVALID" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number };

/**
 * Adresse à laquelle joindre un intervenant.
 *
 * La sienne d'abord, celle de son participant ensuite : un panéliste qui est
 * aussi inscrit au Forum n'a pas à renseigner deux fois la même adresse, et un
 * panéliste qui ne l'est pas doit tout de même pouvoir recevoir son lien.
 */
export function adresseIntervenant(speaker: {
  email: string | null;
  participant: { email: string } | null;
}): string | null {
  return speaker.email ?? speaker.participant?.email ?? null;
}

/**
 * Demande d'accès à l'espace intervenant.
 *
 * Comme pour les participants, la réponse est toujours `SENT` : le formulaire ne
 * doit pas permettre de savoir qui figure au programme avant l'annonce
 * officielle.
 */
export async function requestSpeakerLink(
  editionId: string,
  email: string,
  ip: string,
): Promise<MagicLinkRequestResult> {
  const normalisedEmail = email.trim().toLowerCase();

  const limite = await limiterDemandes(`speaker-link:${normalisedEmail}`);
  if (limite) return limite;

  const speaker = await prisma.speaker.findFirst({
    where: {
      editionId,
      deletedAt: null,
      OR: [{ email: normalisedEmail }, { participant: { email: normalisedEmail } }],
    },
    select: { id: true, firstName: true, email: true, participant: { select: { email: true } } },
  });

  const destinataire = speaker ? adresseIntervenant(speaker) : null;
  if (!speaker || !destinataire) {
    return { status: "SENT" };
  }

  const token = randomBytes(32).toString("base64url");
  const code6 = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000);

  // Même règle que pour les participants : seul le dernier lien envoyé vaut.
  await prisma.magicLink.updateMany({
    where: { speakerId: speaker.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.magicLink.create({
    data: { speakerId: speaker.id, tokenHash: hashToken(token), code6, expiresAt },
  });

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  await enqueueNotification({
    editionId,
    templateKey: "speaker_link",
    to: destinataire,
    variables: {
      prenom: speaker.firstName,
      lien_connexion: `${baseUrl}/espace-intervenant/lien/${token}`,
      code6,
    },
  });

  await audit.log({
    actorType: "SYSTEM",
    action: "speaker_link.requested",
    entity: "Speaker",
    entityId: speaker.id,
    ip,
  });

  return { status: "SENT" };
}

export async function consumeSpeakerLink(token: string): Promise<SpeakerLinkConsumeResult> {
  const magicLink = await prisma.magicLink.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!magicLink || magicLink.usedAt || magicLink.expiresAt.getTime() < Date.now()) {
    return { status: "INVALID" };
  }
  // Réciproque du contrôle ci-dessus : un lien de participant n'ouvre pas
  // l'espace intervenant.
  if (magicLink.speakerId === null) {
    return { status: "INVALID" };
  }
  const speakerId = magicLink.speakerId;

  if (!(await marquerUtilise(magicLink.id))) return { status: "INVALID" };

  await audit.log({
    actorType: "SYSTEM",
    action: "speaker_link.consumed",
    entity: "Speaker",
    entityId: speakerId,
  });

  return { status: "OK", speakerId };
}
