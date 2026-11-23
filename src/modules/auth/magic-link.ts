import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueNotificationPrioritaire } from "@/modules/notifications/jobs";
import { accesEspace, type MotifRefusAcces } from "./acces-espace";

/**
 * Validité d'un lien demandé : **24 heures** (21 novembre 2026).
 *
 * Trente minutes, jusqu'ici. Mais le courriel ne part pas à la seconde où il
 * est demandé : il passe par la file, qui l'étale à vingt par minute
 * (`lib/cadence-envoi.ts`) et qui, lorsque la boîte d'envoi refuse faute de
 * quota, le **reporte de quinze minutes à six heures**
 * (`modules/notifications/jobs.ts`). Les 18 et 20 novembre, les boîtes ont
 * atteint leur plafond : un lien parti ainsi arrivait périmé, son code avec
 * lui, et la personne lisait « lien expiré » sans avoir rien fait de travers.
 *
 * Vingt-quatre heures couvrent le report le plus long. Ce qui borne la force
 * brute n'est pas la durée de vie mais le **nombre d'essais** — cinq par code,
 * dix codes par jour et par adresse (voir plus bas) : allonger la validité ne
 * déplace donc pas le risque. Et le lien d'accès des courriels de confirmation
 * vit déjà quatorze jours dans la même boîte aux lettres (`acces-direct.ts`) :
 * de ces deux liens, celui-ci reste le plus court.
 */
const VALIDITE_LIEN_HEURES = 24;
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
 *
 * Exception (3 novembre 2026) : le **code de secours** de l'e-mail de
 * confirmation (`creerCodeSecours`) survit à une nouvelle demande. Le champ du
 * code n'apparaissait qu'après une demande, qui l'annulait : le code de
 * l'e-mail de confirmation était refusé à coup sûr. Deux codes au plus sont
 * donc comparés — le dernier demandé et le dernier de secours — et le second
 * ne se régénère pas depuis le formulaire : cinq erreurs l'annulent pour de
 * bon. Le risque reste du même ordre (environ 0,01 % par jour).
 *
 * Exception (21 novembre 2026) : le lien et le code **ne se consomment plus**
 * à l'usage, ils valent jusqu'à leur expiration ou leur annulation. Voir
 * `consumeMagicLink`. Cela ne change rien au calcul ci-dessus, qui compte des
 * essais **ratés** : cinq par code, et le code tombe.
 */
const MAX_ECHECS_CODE = 5;
const DEMANDES_PAR_JOUR = 10;
const UN_JOUR_EN_SECONDES = 24 * 60 * 60;

/**
 * Un code de secours vit une semaine, un lien demandé un jour : la durée de vie
 * suffit à les distinguer, sans colonne de plus.
 *
 * Le seuil est à **deux jours** et non à un : le lien demandé en vaut
 * exactement un depuis le 21 novembre 2026, et un seuil posé sur sa propre
 * durée se jouerait à la milliseconde.
 */
const SEUIL_CODE_SECOURS_MS = 2 * UN_JOUR_EN_SECONDES * 1000;

function estCodeSecours(lien: { createdAt: Date; expiresAt: Date }): boolean {
  return lien.expiresAt.getTime() - lien.createdAt.getTime() > SEUIL_CODE_SECOURS_MS;
}

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
 * Annule un lien : il ne vaudra plus, ni par son jeton ni par son code.
 *
 * `usedAt` ne marque plus un usage depuis le 21 novembre 2026 — un lien
 * s'utilise autant de fois qu'il le faut (cf. `consumeMagicLink`) — mais une
 * **annulation** : une nouvelle demande, ou cinq codes erronés.
 *
 * L'écriture reste conditionnelle (`usedAt: null`) : deux annulations
 * concurrentes ne s'écrasent pas, et la première date est celle qui compte.
 */
async function annuler(lienId: string): Promise<void> {
  await prisma.magicLink.updateMany({
    where: { id: lienId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

function codesEgaux(attendu: string, saisi: string): boolean {
  const a = Buffer.from(attendu);
  const b = Buffer.from(saisi);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type MagicLinkRequestResult =
  | { status: "SENT" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }
  | { status: "ACCES_REFUSE"; motif: MotifRefusAcces };

export type MagicLinkConsumeResult =
  | { status: "OK"; participantId: string }
  | { status: "INVALID" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }
  | { status: "ACCES_REFUSE"; motif: MotifRefusAcces };

/** Tout ce qu'il faut pour trancher l'accès, et rien de plus (`acces-espace.ts`). */
const POUR_ACCES = { status: true, category: { select: { requiresAccreditation: true } } } as const;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Demande d'accès à l'espace participant (brief §5.3).
 * Renvoie toujours `SENT` lorsqu'aucun participant ne correspond : sinon le
 * formulaire deviendrait un oracle permettant d'énumérer les e-mails inscrits.
 *
 * **Un dossier non validé ne reçoit rien** (16 novembre 2026) : lui envoyer un
 * lien lui faisait croire son compte ouvert, pour finir sur « lien invalide ou
 * expiré » qui ne disait rien de la vraie raison. Le refus est renvoyé tel
 * quel, pour que l'écran dise ce qu'il en est — c'est le seul endroit où cette
 * réponse est plus explicite que `SENT`, et le prix en est dit dans PLAN.md.
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
    include: { category: { select: { requiresAccreditation: true } } },
  });

  if (!participant || participant.deletedAt) {
    return { status: "SENT" };
  }

  const acces = accesEspace(participant);
  if (!acces.autorise) {
    await audit.log({
      actorType: "PARTICIPANT",
      actorParticipantId: participant.id,
      action: "magic_link.refused",
      entity: "Participant",
      entityId: participant.id,
      after: { motif: acces.motif, statut: participant.status },
      ip,
    });
    return { status: "ACCES_REFUSE", motif: acces.motif };
  }

  const token = randomBytes(32).toString("base64url");
  const code6 = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + VALIDITE_LIEN_HEURES * 3_600 * 1000);

  /*
   * Un seul lien demandé valide à la fois : le dernier envoyé. Les codes de
   * secours, eux, survivent — c'est tout l'objet de l'exception du 3 novembre.
   *
   * Le tri se fait ici et non dans un `where` : la comparaison portait sur
   * l'échéance (`expiresAt <= celle du nouveau lien`), ce qui tenait tant qu'un
   * lien demandé valait trente minutes. À vingt-quatre heures, un code de
   * secours entamé — moins d'un jour restant sur ses sept — serait tombé dans
   * la fourchette et aurait été annulé par une simple demande de lien, faisant
   * échouer le code du courriel de confirmation. La nature d'un lien se lit à
   * sa durée (`estCodeSecours`), pas à sa date de fin.
   */
  const valides = await prisma.magicLink.findMany({
    where: { participantId: participant.id, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true },
  });
  const aAnnuler = valides.filter((lien) => !estCodeSecours(lien)).map((lien) => lien.id);
  if (aAnnuler.length > 0) {
    await prisma.magicLink.updateMany({
      where: { id: { in: aAnnuler } },
      data: { usedAt: new Date() },
    });
  }

  await prisma.magicLink.create({
    data: { participantId: participant.id, tokenHash: hashToken(token), code6, expiresAt },
  });

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  // En tête de file : la personne attend son lien devant l'écran.
  await enqueueNotificationPrioritaire({
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

/**
 * Code de secours joint à un e-mail de confirmation (`acces-direct.ts`).
 *
 * Même table et mêmes règles que les codes demandés depuis « Mon espace » :
 * seul le dernier code valide est comparé, cinq erreurs l'annulent. Il ne
 * s'accompagne pas d'un lien — c'est le lien signé de l'e-mail qui en tient
 * lieu — et n'annule pas les codes précédents : ceux-ci ne sont de toute
 * façon plus comparés. Une demande de lien depuis « Mon espace » ne l'annule
 * pas non plus.
 */
export async function creerCodeSecours(participantId: string, jours: number): Promise<string> {
  const code6 = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.magicLink.create({
    data: {
      participantId,
      // Jeton aléatoire jamais transmis : le code est le seul moyen d'usage.
      tokenHash: hashToken(randomBytes(32).toString("base64url")),
      code6,
      expiresAt: new Date(Date.now() + jours * 24 * 60 * 60 * 1000),
    },
  });
  return code6;
}

/**
 * Ouverture de l'espace par le jeton du courriel.
 *
 * ## Le lien ne se consomme plus (21 novembre 2026)
 *
 * Il était à usage unique. Trois usages ordinaires le brûlaient sans que
 * personne ne se soit connecté :
 *
 * - **les passerelles de messagerie d'entreprise** ouvrent les liens d'un
 *   message pour les analyser avant le destinataire (Defender, Proofpoint). Le
 *   lien était consommé par l'antivirus, et la personne cliquait sur un lien
 *   déjà mort. C'est l'argument qui avait déjà rendu réutilisable le lien
 *   d'accès des courriels de confirmation (`acces-direct.ts`) ; il valait tout
 *   autant ici, et n'y avait pas été repris ;
 * - **le code puis le lien**, ou l'inverse : le courriel propose les deux, et
 *   les deux vivent sur la même ligne. Saisir le code sur son téléphone rendait
 *   le lien du courriel inopérant sur l'ordinateur ;
 * - **un rechargement**, un second onglet, un retour en arrière.
 *
 * Le lien vaut donc jusqu'à son expiration (vingt-quatre heures) ou son
 * annulation. Ce que cela expose : rien de plus que le courriel qui le porte —
 * qui accède à la boîte peut de toute façon demander un lien. Et le jeton tient
 * dans trente-deux octets aléatoires dont seule l'empreinte est stockée.
 */
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

  /*
   * Le statut est revérifié ici, et pas seulement à l'envoi : un lien émis
   * avant une annulation, ou avant la règle du 16 novembre 2026, ne doit pas
   * ouvrir un espace fermé. Le jeton n'est **pas** consommé dans ce cas — il
   * n'a servi à rien, et le brûler ajouterait un « lien expiré » au refus.
   */
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, deletedAt: null },
    select: POUR_ACCES,
  });
  if (!participant) return { status: "INVALID" };
  const acces = accesEspace(participant);
  if (!acces.autorise) return { status: "ACCES_REFUSE", motif: acces.motif };

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
    include: { category: { select: { requiresAccreditation: true } } },
  });
  if (!participant || participant.deletedAt) return { status: "INVALID" };

  /*
   * Accès refusé : on le dit **avant** de comparer quoi que ce soit. Compter
   * un essai raté contre le code, ou l'annuler au bout de cinq, punirait
   * quelqu'un dont le code est peut-être juste et dont le seul tort est
   * d'attendre la validation de son dossier.
   */
  const acces = accesEspace(participant);
  if (!acces.autorise) return { status: "ACCES_REFUSE", motif: acces.motif };

  /*
   * Seuls le **dernier** lien demandé et le **dernier** code de secours encore
   * valides sont comparés. La recherche portait auparavant sur le code parmi
   * tous les liens valides, ce qui multipliait les chances d'un essai au
   * hasard ; les liens d'avant cette règle restent en base mais ne sont plus
   * jamais comparés.
   */
  const valides = await prisma.magicLink.findMany({
    where: { participantId: participant.id, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const candidats = [
    valides.find((lien) => !estCodeSecours(lien)),
    valides.find(estCodeSecours),
  ].filter((lien) => lien !== undefined);
  if (candidats.length === 0) return { status: "INVALID" };

  const magicLink = candidats.find((lien) => codesEgaux(lien.code6, code6));
  if (!magicLink) {
    // L'erreur compte contre chacun des codes comparés.
    for (const lien of candidats) {
      const apres = await prisma.magicLink.update({
        where: { id: lien.id },
        data: { failedAttempts: { increment: 1 } },
      });
      if (apres.failedAttempts >= MAX_ECHECS_CODE) {
        // Lien annulé : le prochain essai demande un nouvel envoi.
        await annuler(lien.id);
      }
    }
    return { status: "INVALID" };
  }

  /*
   * Le code juste n'annule rien (21 novembre 2026) : il vaut jusqu'à son
   * expiration, comme le lien de la même ligne. Le consommer empêchait de
   * rouvrir son espace depuis un second appareil, et rendait inopérant le lien
   * du même courriel — un « lien expiré » sur un lien jamais ouvert.
   */
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
  const expiresAt = new Date(Date.now() + VALIDITE_LIEN_HEURES * 3_600 * 1000);

  // Même règle que pour les participants : seul le dernier lien envoyé vaut.
  // Aucun code de secours n'existe pour un intervenant : rien à épargner ici.
  await prisma.magicLink.updateMany({
    where: { speakerId: speaker.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.magicLink.create({
    data: { speakerId: speaker.id, tokenHash: hashToken(token), code6, expiresAt },
  });

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  await enqueueNotificationPrioritaire({
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

  // Réutilisable jusqu'à son expiration, pour les mêmes raisons que le lien
  // participant (cf. `consumeMagicLink`) : les intervenants lisent leur
  // courrier sur des messageries institutionnelles, celles qui ouvrent les
  // liens avant eux.
  await audit.log({
    actorType: "SYSTEM",
    action: "speaker_link.consumed",
    entity: "Speaker",
    entityId: speakerId,
  });

  return { status: "OK", speakerId };
}
