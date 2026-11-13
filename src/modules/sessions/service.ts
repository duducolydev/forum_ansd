import type { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import { oublierProgramme } from "@/modules/notifications/recap-programme";
import * as repo from "./repository";
import type { SessionRow } from "./repository";
import {
  comparerSession,
  figerEtat,
  lireEtatAnnonce,
  type Changement,
  type EtatSuivi,
} from "./changements";
import { alerterSansBloquer, alerterSession } from "./notifications";
import { ordonnerIntervenants } from "./ordre-intervenants";
import { slugifier, type RoomInput, type SessionInput } from "./schema";

export interface Actor {
  type: "USER" | "PARTICIPANT" | "SYSTEM";
  userId?: string;
}

export class SessionRuleError extends Error {}

// ---------------------------------------------------------------------------
// État d'une session — une seule définition, partagée public et BackOffice
// ---------------------------------------------------------------------------

export type EtatSession =
  "SANS_RESERVATION" | "OUVERTE" | "LISTE_ATTENTE" | "COMPLETE" | "CLOTUREE";

export interface PlacesSession {
  etat: EtatSession;
  capacite: number | null;
  inscrits: number;
  attente: number;
  restantes: number | null;
}

export const ETAT_LABELS: Record<EtatSession, string> = {
  SANS_RESERVATION: "Sans réservation",
  OUVERTE: "Ouvert",
  LISTE_ATTENTE: "Liste d'attente",
  COMPLETE: "Complet",
  CLOTUREE: "Clôturé",
};

/**
 * État et places d'une session (brief §5.5).
 *
 * **Fonction pure**, calculée à un seul endroit : la page publique, l'écran
 * d'administration et — au chantier 4.5 — le contrôle à l'inscription doivent
 * dire la même chose. Un « il reste 3 places » affiché ici et un refus rendu
 * là-bas serait incompréhensible pour le participant.
 *
 * Le `vipQuota` n'est **pas** retranché du compteur affiché : il ne réduit pas
 * le nombre de places de la salle, il en réserve une partie à une population.
 * C'est à la réservation (4.5) de le faire respecter ; l'afficher ici ferait
 * croire à des places manquantes.
 */
export function calculerPlaces(
  session: Pick<
    SessionRow,
    "capacity" | "registrationOpen" | "registrationDeadline" | "waitlistEnabled"
  >,
  compteurs: { inscrits: number; attente: number },
  maintenant: Date = new Date(),
): PlacesSession {
  const base = {
    capacite: session.capacity,
    inscrits: compteurs.inscrits,
    attente: compteurs.attente,
    restantes:
      session.capacity === null ? null : Math.max(session.capacity - compteurs.inscrits, 0),
  };

  if (!session.registrationOpen) {
    return { ...base, etat: "SANS_RESERVATION" };
  }
  if (
    session.registrationDeadline &&
    session.registrationDeadline.getTime() < maintenant.getTime()
  ) {
    return { ...base, etat: "CLOTUREE" };
  }
  if (base.restantes !== null && base.restantes > 0) {
    return { ...base, etat: "OUVERTE" };
  }
  return { ...base, etat: session.waitlistEnabled ? "LISTE_ATTENTE" : "COMPLETE" };
}

// ---------------------------------------------------------------------------
// Salles
// ---------------------------------------------------------------------------

export async function listRooms(editionId: string) {
  return repo.listRooms(editionId);
}

export async function createRoom(editionId: string, input: RoomInput, actor: Actor) {
  const salle = await repo.createRoom(editionId, {
    name: input.name,
    capacity: input.capacity ?? null,
    floor: input.floor || null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "room.create",
    entity: "Room",
    entityId: salle.id,
    after: { name: salle.name, capacity: salle.capacity },
  });

  return salle;
}

export async function updateRoom(id: string, input: RoomInput, actor: Actor) {
  const salle = await repo.updateRoom(id, {
    name: input.name,
    capacity: input.capacity ?? null,
    floor: input.floor || null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "room.update",
    entity: "Room",
    entityId: id,
    after: { name: salle.name, capacity: salle.capacity },
  });

  return salle;
}

export async function deleteRoom(id: string, actor: Actor) {
  const sessions = await repo.countSessionsInRoom(id);
  if (sessions > 0) {
    throw new SessionRuleError(
      `Cette salle accueille ${sessions} session(s). Déplacez-les avant de la supprimer.`,
    );
  }

  await repo.deleteRoom(id);
  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "room.delete",
    entity: "Room",
    entityId: id,
  });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/**
 * Recompose un instant depuis `jour` + `HH:MM`.
 *
 * Dakar est à UTC toute l'année : l'heure saisie est donc l'heure vécue sur
 * place, sans conversion. Voir le commentaire de `schema.ts` pour le jour où
 * cette hypothèse cesserait d'être vraie.
 */
function instant(jour: string, heure: string): Date {
  return new Date(`${jour}T${heure}:00.000Z`);
}

async function slugUnique(editionId: string, souhaite: string, exceptId?: string): Promise<string> {
  const base = souhaite || "session";
  let candidat = base;
  let suffixe = 2;
  // Deux panels peuvent porter le même titre sur deux journées : on numérote
  // plutôt que de refuser, l'utilisateur n'ayant pas à connaître nos clés.
  while (await repo.slugExiste(editionId, candidat, exceptId)) {
    candidat = `${base}-${suffixe++}`;
  }
  return candidat;
}

function versDonnees(editionId: string, input: SessionInput) {
  return {
    editionId,
    type: input.type,
    number: input.number ?? null,
    titleFr: input.titleFr,
    titleEn: input.titleEn || input.titleFr,
    titlePt: input.titlePt || null,
    descriptionFr: input.descriptionFr || null,
    descriptionEn: input.descriptionEn || null,
    descriptionPt: input.descriptionPt || null,
    objectives: input.objectives || null,
    theme: input.theme || null,
    day: new Date(`${input.day}T00:00:00.000Z`),
    startTime: instant(input.day, input.startTime),
    endTime: instant(input.day, input.endTime),
    roomId: input.roomId || null,
    capacity: input.capacity ?? null,
    registrationOpen: input.registrationOpen,
    registrationDeadline: input.registrationDeadline
      ? new Date(`${input.registrationDeadline}T23:59:59.000Z`)
      : null,
    waitlistEnabled: input.waitlistEnabled,
    vipQuota: input.vipQuota ?? null,
    liveStreamUrl: input.liveStreamUrl || null,
    isPublished: input.isPublished,
  };
}

export async function listSessions(editionId: string, options: { onlyPublished?: boolean } = {}) {
  const sessions = await repo.listSessions(editionId, options);
  const compteurs = await repo.countRegistrations(sessions.map((session) => session.id));

  return sessions.map((session) => ({
    ...session,
    speakers: ordonnerIntervenants(session.speakers),
    places: calculerPlaces(session, compteurs.get(session.id) ?? { inscrits: 0, attente: 0 }),
  }));
}

export async function getSession(id: string) {
  const session = await repo.findSession(id);
  if (!session) return null;
  const compteurs = await repo.countRegistrations([session.id]);
  return {
    ...session,
    // Modérateurs en tête, puis panélistes (`ordre-intervenants.ts`).
    speakers: ordonnerIntervenants(session.speakers),
    places: calculerPlaces(session, compteurs.get(session.id) ?? { inscrits: 0, attente: 0 }),
  };
}

export async function getSessionBySlug(editionId: string, slug: string) {
  const session = await repo.findSessionBySlug(editionId, slug);
  if (!session) return null;
  const compteurs = await repo.countRegistrations([session.id]);
  return {
    ...session,
    // Modérateurs en tête, puis panélistes (`ordre-intervenants.ts`).
    speakers: ordonnerIntervenants(session.speakers),
    places: calculerPlaces(session, compteurs.get(session.id) ?? { inscrits: 0, attente: 0 }),
  };
}

export async function createSession(editionId: string, input: SessionInput, actor: Actor) {
  const slug = await slugUnique(editionId, input.slug || slugifier(input.titleFr));
  const session = await repo.createSession({ ...versDonnees(editionId, input), slug });
  oublierProgramme(editionId);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "session.create",
    entity: "Session",
    entityId: session.id,
    after: { slug: session.slug, titleFr: session.titleFr, day: session.day },
  });

  return session;
}

export async function updateSession(
  editionId: string,
  id: string,
  input: SessionInput,
  actor: Actor,
) {
  const avant = await repo.findSession(id);
  if (!avant) throw new SessionRuleError("Session introuvable.");

  const slug = await slugUnique(editionId, input.slug || slugifier(input.titleFr), id);
  const session = await repo.updateSession(id, {
    ...versDonnees(editionId, input),
    slug,
    ...etatConnuAvant(avant),
  });
  oublierProgramme(editionId);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "session.update",
    entity: "Session",
    entityId: id,
    before: { titleFr: avant.titleFr, isPublished: avant.isPublished, day: avant.day },
    after: { titleFr: session.titleFr, isPublished: session.isPublished, day: session.day },
  });

  // Aucun envoi ici : c'est le bouton « Prévenir les inscrits » qui décide
  // (13 novembre 2026). Un envoi d'office aurait écrit trois fois à deux cents
  // personnes pour un horaire corrigé en trois essais, et la correction d'une
  // coquille au milieu d'une refonte serait partie seule.
  return { ...session, changements: changementsNonAnnonces(session).length };
}

/**
 * Pose l'état annoncé d'une session publiée qui n'en a pas encore.
 *
 * Le programme tournait avant que ces colonnes existent : les sessions déjà en
 * ligne n'ont pas d'état annoncé, et sans celui-ci le bouton n'aurait jamais
 * rien à annoncer. L'état retenu est celui d'**avant** la modification en
 * cours : c'est bien ce que le public avait sous les yeux.
 *
 * Posé ici et non par la migration : une reprise en masse aurait affirmé, pour
 * chaque session, un état annoncé que personne n'a vérifié.
 */
function etatConnuAvant(avant: SessionRow): { announcedState?: Prisma.InputJsonValue } {
  if (!avant.isPublished || lireEtatAnnonce(avant.announcedState)) return {};
  return { announcedState: figerEtat(etatSuivi(avant)) };
}

/**
 * Ce qui a changé depuis le dernier message envoyé aux inscrits.
 *
 * Vide tant que la session n'est pas publiée (rien n'a été annoncé) ou qu'aucun
 * état annoncé n'est enregistré. Comparer à l'état annoncé plutôt qu'à l'état
 * précédent est ce qui permet de corriger un horaire en trois essais et de
 * n'écrire qu'une fois : un aller-retour revient à l'état connu, et ne laisse
 * donc rien à dire.
 */
export function changementsNonAnnonces(session: SessionRow): Changement[] {
  if (!session.isPublished) return [];
  const annonce = lireEtatAnnonce(session.announcedState);
  if (!annonce) return [];
  return comparerSession(annonce, etatSuivi(session));
}

function etatSuivi(session: SessionRow): EtatSuivi {
  return {
    titleFr: session.titleFr,
    titleEn: session.titleEn,
    titlePt: session.titlePt,
    day: session.day,
    startTime: session.startTime,
    endTime: session.endTime,
    salle: session.room?.name ?? null,
  };
}

/**
 * Envoie l'annonce, sur geste explicite du comité.
 *
 * L'état annoncé n'est mis à jour **qu'après** la mise en file : si celle-ci
 * échoue, la session reste « à annoncer » et le bouton se represse, au lieu de
 * laisser croire que le message est parti.
 */
export async function annoncerChangements(
  id: string,
  actor: Actor,
): Promise<{ prevenus: number; changements: number }> {
  const session = await repo.findSession(id);
  if (!session) throw new SessionRuleError("Session introuvable.");
  if (!session.isPublished) {
    throw new SessionRuleError(
      "Cette session n'est pas publiée : il n'y a rien à annoncer tant qu'elle ne figure pas au programme.",
    );
  }

  const changements = changementsNonAnnonces(session);
  if (changements.length === 0) {
    throw new SessionRuleError("Rien de nouveau à annoncer depuis le dernier message.");
  }

  const prevenus = await alerterSession({
    editionId: session.editionId,
    sessionId: session.id,
    slug: session.slug,
    titre: { fr: session.titleFr, en: session.titleEn, pt: session.titlePt },
    motif: "modifiee",
    changements,
    empreinte: session.updatedAt.toISOString(),
  });

  await repo.updateSession(id, {
    announcedState: figerEtat(etatSuivi(session)),
    announcedAt: new Date(),
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "session.announced",
    entity: "Session",
    entityId: id,
    after: { prevenus, changements: changements.map((ligne) => ligne.texte.fr) },
  });

  return { prevenus, changements: changements.length };
}

/**
 * Duplique une session (brief §5.8).
 *
 * La copie repart **en brouillon et sans réservation ouverte** : dupliquer un
 * panel pour en préparer un autre ne doit pas mettre en ligne, à la seconde, une
 * session dont le titre et l'horaire sont encore ceux de l'original. Les
 * intervenants ne sont pas repris — ce sont rarement les mêmes, et un panéliste
 * annoncé par erreur est un incident de protocole.
 */
export async function duplicateSession(editionId: string, id: string, actor: Actor) {
  const source = await repo.findSession(id);
  if (!source) throw new SessionRuleError("Session introuvable.");

  const slug = await slugUnique(editionId, `${source.slug}-copie`);
  const copie = await repo.createSession({
    editionId,
    slug,
    number: null,
    type: source.type,
    titleFr: `${source.titleFr} (copie)`,
    titleEn: `${source.titleEn} (copy)`,
    titlePt: source.titlePt ? `${source.titlePt} (cópia)` : null,
    descriptionFr: source.descriptionFr,
    descriptionEn: source.descriptionEn,
    descriptionPt: source.descriptionPt,
    objectives: source.objectives,
    theme: source.theme,
    day: source.day,
    startTime: source.startTime,
    endTime: source.endTime,
    roomId: source.room?.id ?? null,
    capacity: source.capacity,
    registrationOpen: false,
    registrationDeadline: source.registrationDeadline,
    waitlistEnabled: source.waitlistEnabled,
    vipQuota: source.vipQuota,
    liveStreamUrl: source.liveStreamUrl,
    isPublished: false,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "session.duplicate",
    entity: "Session",
    entityId: copie.id,
    after: { source: id, slug: copie.slug },
  });

  return copie;
}

/**
 * Publie ou dépublie une session.
 *
 * `prevenir` n'a de sens qu'au retrait, et il est **décidé par l'appelant** :
 * la boîte de dialogue du BackOffice pose la question, le script du programme
 * officiel n'écrit à personne (`prevenir` vaut faux par défaut). Un envoi
 * d'office au retrait était l'automatisme que le comité a refusé.
 */
export async function setPublished(
  id: string,
  isPublished: boolean,
  actor: Actor,
  options: { prevenir?: boolean } = {},
) {
  const avant = await repo.findSession(id);
  if (!avant) throw new SessionRuleError("Session introuvable.");

  const session = await repo.updateSession(id, {
    isPublished,
    // Mettre une session en ligne, c'est l'annoncer dans l'état où elle est :
    // les retouches faites en brouillon n'ont donc rien à rattraper ensuite.
    ...(isPublished && !avant.isPublished
      ? { announcedState: figerEtat(etatSuivi(avant)), announcedAt: new Date() }
      : {}),
  });
  oublierProgramme(session.editionId);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: isPublished ? "session.publish" : "session.unpublish",
    entity: "Session",
    entityId: id,
    after: { isPublished, prevenus: options.prevenir === true },
  });

  // Retirer une session de l'affiche, c'est l'annuler pour ceux qui l'avaient
  // notée. La remettre en ligne n'écrit jamais : ils n'ont rien su de son
  // retrait, et une annonce de « rétablissement » créerait l'inquiétude
  // qu'elle prétend lever.
  const prevenus =
    options.prevenir && avant.isPublished && !isPublished
      ? await alerterSansBloquer({
          editionId: avant.editionId,
          sessionId: id,
          slug: session.slug,
          titre: { fr: session.titleFr, en: session.titleEn, pt: session.titlePt },
          motif: "annulee",
          changements: [],
          empreinte: session.updatedAt.toISOString(),
        })
      : 0;

  return { ...session, prevenus };
}

export async function deleteSession(
  id: string,
  actor: Actor,
  options: { prevenir?: boolean } = {},
) {
  const session = await repo.findSession(id);
  if (!session) throw new SessionRuleError("Session introuvable.");
  if (session._count.registrations > 0) {
    throw new SessionRuleError(
      `Cette session porte ${session._count.registrations} inscription(s). Dépubliez-la plutôt que de la supprimer.`,
    );
  }

  const supprimee = await repo.softDeleteSession(id);
  oublierProgramme(session.editionId);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "session.delete",
    entity: "Session",
    entityId: id,
    before: { slug: session.slug, titleFr: session.titleFr },
    after: { prevenus: options.prevenir === true },
  });

  // Une session supprimée ne porte aucune inscription (la règle ci-dessus le
  // garantit) : restent les intervenants, qui avaient bloqué le créneau et à
  // qui plus rien ne l'apprendrait — si le comité l'a demandé.
  const prevenus =
    options.prevenir && session.isPublished
      ? await alerterSansBloquer({
          editionId: session.editionId,
          sessionId: id,
          slug: session.slug,
          titre: { fr: session.titleFr, en: session.titleEn, pt: session.titlePt },
          motif: "annulee",
          changements: [],
          empreinte: supprimee.updatedAt.toISOString(),
        })
      : 0;

  return { prevenus };
}

export async function setTdrPath(id: string, tdrPath: string | null, actor: Actor) {
  await repo.updateSession(id, { tdrPath });
  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: tdrPath ? "session.tdr_upload" : "session.tdr_remove",
    entity: "Session",
    entityId: id,
    after: { tdrPath },
  });
}
