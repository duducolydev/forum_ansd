import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Salles
// ---------------------------------------------------------------------------

export async function listRooms(editionId: string) {
  return prisma.room.findMany({
    where: { editionId },
    // De la plus grande à la plus petite : c'est l'ordre dans lequel on lit une
    // grille de conférence, la plénière d'abord et les ateliers ensuite. Un tri
    // alphabetique plaçait la salle des ateliers en tete, ce qui se lit mal.
    orderBy: [{ capacity: "desc" }, { name: "asc" }],
    include: { _count: { select: { sessions: true } } },
  });
}

export async function createRoom(editionId: string, data: Prisma.RoomCreateWithoutEditionInput) {
  return prisma.room.create({ data: { ...data, edition: { connect: { id: editionId } } } });
}

export async function updateRoom(id: string, data: Prisma.RoomUpdateInput) {
  return prisma.room.update({ where: { id }, data });
}

export async function deleteRoom(id: string) {
  return prisma.room.delete({ where: { id } });
}

export async function countSessionsInRoom(roomId: string) {
  return prisma.session.count({ where: { roomId, deletedAt: null } });
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Projection commune : tout ce qu'il faut pour afficher une session, nulle part ailleurs. */
const SELECTION = {
  id: true,
  slug: true,
  number: true,
  type: true,
  titleFr: true,
  titleEn: true,
  descriptionFr: true,
  descriptionEn: true,
  objectives: true,
  theme: true,
  day: true,
  startTime: true,
  endTime: true,
  capacity: true,
  registrationOpen: true,
  registrationDeadline: true,
  waitlistEnabled: true,
  vipQuota: true,
  tdrPath: true,
  isPublished: true,
  liveStreamUrl: true,
  room: { select: { id: true, name: true, capacity: true } },
  speakers: {
    orderBy: { sortOrder: "asc" },
    select: {
      role: true,
      confirmationStatus: true,
      speaker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          organization: true,
          country: true,
          photoPath: true,
          bioFr: true,
          bioEn: true,
          isPublished: true,
        },
      },
    },
  },
  _count: { select: { registrations: true } },
} satisfies Prisma.SessionSelect;

export type SessionRow = Prisma.SessionGetPayload<{ select: typeof SELECTION }>;

export async function listSessions(editionId: string, options: { onlyPublished?: boolean } = {}) {
  return prisma.session.findMany({
    where: {
      editionId,
      deletedAt: null,
      ...(options.onlyPublished ? { isPublished: true } : {}),
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }, { number: "asc" }],
    select: SELECTION,
  });
}

export async function findSession(id: string) {
  return prisma.session.findFirst({ where: { id, deletedAt: null }, select: SELECTION });
}

export async function findSessionBySlug(editionId: string, slug: string) {
  return prisma.session.findFirst({
    where: { editionId, slug, deletedAt: null },
    select: SELECTION,
  });
}

export async function slugExiste(editionId: string, slug: string, exceptId?: string) {
  const existante = await prisma.session.findFirst({
    where: { editionId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return existante !== null;
}

export async function createSession(data: Prisma.SessionUncheckedCreateInput) {
  return prisma.session.create({ data, select: SELECTION });
}

export async function updateSession(id: string, data: Prisma.SessionUncheckedUpdateInput) {
  return prisma.session.update({ where: { id }, data, select: SELECTION });
}

/**
 * Suppression **logique** : une session peut porter des inscriptions et des
 * contributions ; l'effacer emporterait des faits (qui s'était inscrit, qui est
 * venu) que le rapport du jour J doit pouvoir retrouver.
 */
export async function softDeleteSession(id: string) {
  return prisma.session.update({
    where: { id },
    data: { deletedAt: new Date(), isPublished: false },
  });
}

/** Inscriptions actives par session, pour le compteur de places. */
export async function countRegistrations(sessionIds: string[]) {
  if (sessionIds.length === 0) return new Map<string, { inscrits: number; attente: number }>();

  const lignes = await prisma.sessionRegistration.groupBy({
    by: ["sessionId", "status"],
    where: { sessionId: { in: sessionIds } },
    _count: { _all: true },
  });

  const parSession = new Map<string, { inscrits: number; attente: number }>();
  for (const ligne of lignes) {
    const courant = parSession.get(ligne.sessionId) ?? { inscrits: 0, attente: 0 };
    // `ATTENDED` compte comme inscrit : la personne occupe bien une place.
    if (ligne.status === "REGISTERED" || ligne.status === "ATTENDED") {
      courant.inscrits += ligne._count._all;
    } else if (ligne.status === "WAITLISTED") {
      courant.attente += ligne._count._all;
    }
    parSession.set(ligne.sessionId, courant);
  }
  return parSession;
}
