import { audit } from "@/lib/audit";
import * as repo from "./repository";
import type { SessionRow } from "./repository";
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
    descriptionFr: input.descriptionFr || null,
    descriptionEn: input.descriptionEn || null,
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
    places: calculerPlaces(session, compteurs.get(session.id) ?? { inscrits: 0, attente: 0 }),
  }));
}

export async function getSession(id: string) {
  const session = await repo.findSession(id);
  if (!session) return null;
  const compteurs = await repo.countRegistrations([session.id]);
  return {
    ...session,
    places: calculerPlaces(session, compteurs.get(session.id) ?? { inscrits: 0, attente: 0 }),
  };
}

export async function getSessionBySlug(editionId: string, slug: string) {
  const session = await repo.findSessionBySlug(editionId, slug);
  if (!session) return null;
  const compteurs = await repo.countRegistrations([session.id]);
  return {
    ...session,
    places: calculerPlaces(session, compteurs.get(session.id) ?? { inscrits: 0, attente: 0 }),
  };
}

export async function createSession(editionId: string, input: SessionInput, actor: Actor) {
  const slug = await slugUnique(editionId, input.slug || slugifier(input.titleFr));
  const session = await repo.createSession({ ...versDonnees(editionId, input), slug });

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
  const session = await repo.updateSession(id, { ...versDonnees(editionId, input), slug });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "session.update",
    entity: "Session",
    entityId: id,
    before: { titleFr: avant.titleFr, isPublished: avant.isPublished, day: avant.day },
    after: { titleFr: session.titleFr, isPublished: session.isPublished, day: session.day },
  });

  return session;
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
    descriptionFr: source.descriptionFr,
    descriptionEn: source.descriptionEn,
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

export async function setPublished(id: string, isPublished: boolean, actor: Actor) {
  const session = await repo.updateSession(id, { isPublished });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: isPublished ? "session.publish" : "session.unpublish",
    entity: "Session",
    entityId: id,
    after: { isPublished },
  });

  return session;
}

export async function deleteSession(id: string, actor: Actor) {
  const session = await repo.findSession(id);
  if (!session) throw new SessionRuleError("Session introuvable.");
  if (session._count.registrations > 0) {
    throw new SessionRuleError(
      `Cette session porte ${session._count.registrations} inscription(s). Dépubliez-la plutôt que de la supprimer.`,
    );
  }

  await repo.softDeleteSession(id);
  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "session.delete",
    entity: "Session",
    entityId: id,
    before: { slug: session.slug, titleFr: session.titleFr },
  });
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
