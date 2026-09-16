import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

/**
 * Réservation des panels (brief §5.5).
 *
 * Tout passe par une transaction qui commence par **verrouiller la ligne de la
 * session** (`SELECT … FOR UPDATE`). C'est le seul moyen de garantir qu'à la
 * dernière place disponible, vingt candidats simultanés donnent un inscrit et
 * dix-neuf refus — et non vingt inscrits dans une salle de cent.
 *
 * Prisma n'exprime pas le verrouillage de ligne : c'est l'exception SQL brute
 * annoncée en C14, localisée ici et nulle part ailleurs.
 *
 * L'ordre compte : le verrou est pris **avant** toute lecture de comptage. En
 * InnoDB, l'instantané de lecture d'une transaction est établi à la première
 * lecture cohérente ; en prenant le verrou d'abord, les comptages qui suivent
 * voient l'état réellement à jour, et non celui d'avant l'attente.
 */

export type MotifRefus =
  | "SESSION_INTROUVABLE"
  | "RESERVATION_FERMEE"
  | "ECHEANCE_PASSEE"
  | "PARTICIPANT_NON_CONFIRME"
  | "DEJA_INSCRIT"
  | "CHEVAUCHEMENT"
  | "COMPLET";

export class RefusInscription extends Error {
  constructor(
    readonly motif: MotifRefus,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

export type ResultatInscription =
  { statut: "INSCRIT" } | { statut: "LISTE_ATTENTE"; position: number };

/** Statuts d'un participant admis à réserver : il doit être confirmé. */
const STATUTS_ADMIS: Prisma.ParticipantWhereInput["status"] = {
  in: ["CONFIRMED", "BADGED", "CHECKED_IN"],
};

/** Inscriptions qui occupent une place. */
const OCCUPENT: Prisma.SessionRegistrationWhereInput["status"] = { in: ["REGISTERED", "ATTENDED"] };

/**
 * Plafond ouvert à la réservation en ligne.
 *
 * Le `vipQuota` retire des places du libre-service : ce sont les sièges que le
 * protocole garde pour placer les autorités à la main. Il ne réduit pas la
 * salle — d'où un compteur public qui affiche la capacité entière (cf. 4.4).
 *
 * **Lecture à faire confirmer par l'ANSD** : le brief dit « en tenant compte du
 * `vipQuota` réservé » sans préciser qui peut y puiser. Réserver les sièges à
 * l'inscription manuelle est la seule interprétation qui n'exige pas de
 * qualifier chaque catégorie de VIP ou non, et c'est ainsi que le protocole
 * fonctionne en pratique.
 */
export function plafondLibreService(capacite: number, vipQuota: number | null): number {
  return Math.max(capacite - (vipQuota ?? 0), 0);
}

async function verrouillerSession(tx: Prisma.TransactionClient, sessionId: string) {
  const verrou = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM Session WHERE id = ${sessionId} AND deletedAt IS NULL FOR UPDATE
  `;
  if (verrou.length === 0) {
    throw new RefusInscription("SESSION_INTROUVABLE", "Cette session n'existe pas.");
  }
}

/**
 * Une session dont l'horaire empiète sur celui-ci, et où le participant est
 * déjà inscrit. Se réserver deux panels simultanés n'a pas de sens et fait
 * perdre une place à quelqu'un d'autre.
 */
async function chevauchement(
  tx: Prisma.TransactionClient,
  participantId: string,
  session: { id: string; day: Date; startTime: Date; endTime: Date },
) {
  return tx.sessionRegistration.findFirst({
    where: {
      participantId,
      status: OCCUPENT,
      session: {
        id: { not: session.id },
        deletedAt: null,
        day: session.day,
        // Deux intervalles se recouvrent si chacun commence avant que l'autre
        // ne finisse. Écrit ainsi plutôt qu'en énumérant les cas, où l'on
        // oublie toujours celui de l'englobement.
        startTime: { lt: session.endTime },
        endTime: { gt: session.startTime },
      },
    },
    select: { session: { select: { titleFr: true } } },
  });
}

export async function inscrire(
  sessionId: string,
  participantId: string,
  options: { parPersonnel?: boolean; actorUserId?: string } = {},
): Promise<ResultatInscription> {
  const resultat = await prisma.$transaction(
    async (tx) => {
      await verrouillerSession(tx, sessionId);

      const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        select: {
          id: true,
          titleFr: true,
          day: true,
          startTime: true,
          endTime: true,
          capacity: true,
          vipQuota: true,
          registrationOpen: true,
          registrationDeadline: true,
          waitlistEnabled: true,
          isPublished: true,
        },
      });

      // Le personnel place une personne à la main : il n'est arrêté ni par
      // l'échéance ni par la fermeture des réservations, qui visent le public.
      if (!options.parPersonnel) {
        if (!session.registrationOpen || !session.isPublished) {
          throw new RefusInscription(
            "RESERVATION_FERMEE",
            "Les réservations ne sont pas ouvertes pour cette session.",
          );
        }
        if (session.registrationDeadline && session.registrationDeadline.getTime() < Date.now()) {
          throw new RefusInscription(
            "ECHEANCE_PASSEE",
            "La date limite de réservation est dépassée.",
          );
        }
      }

      const participant = await tx.participant.findFirst({
        where: { id: participantId, deletedAt: null, status: STATUTS_ADMIS },
        select: { id: true },
      });
      if (!participant) {
        throw new RefusInscription(
          "PARTICIPANT_NON_CONFIRME",
          "Votre inscription au Forum doit être confirmée avant de réserver un panel.",
        );
      }

      const existante = await tx.sessionRegistration.findUnique({
        where: { sessionId_participantId: { sessionId, participantId } },
        select: { id: true, status: true, waitlistPosition: true },
      });
      if (existante && existante.status !== "CANCELLED") {
        throw new RefusInscription("DEJA_INSCRIT", "Vous êtes déjà inscrit à cette session.");
      }

      const conflit = await chevauchement(tx, participantId, session);
      if (conflit) {
        throw new RefusInscription(
          "CHEVAUCHEMENT",
          "Vous êtes déjà inscrit à une session qui se tient au même moment.",
          conflit.session.titleFr,
        );
      }

      const occupees = await tx.sessionRegistration.count({
        where: { sessionId, status: OCCUPENT },
      });
      const plafond =
        session.capacity === null
          ? Number.POSITIVE_INFINITY
          : options.parPersonnel
            ? session.capacity
            : plafondLibreService(session.capacity, session.vipQuota);

      if (occupees < plafond) {
        await ecrire(tx, existante?.id, {
          sessionId,
          participantId,
          status: "REGISTERED",
          waitlistPosition: null,
        });
        return { statut: "INSCRIT" as const, titre: session.titleFr };
      }

      if (!session.waitlistEnabled) {
        throw new RefusInscription("COMPLET", "Cette session est complète.");
      }

      const dernier = await tx.sessionRegistration.findFirst({
        where: { sessionId, status: "WAITLISTED" },
        orderBy: { waitlistPosition: "desc" },
        select: { waitlistPosition: true },
      });
      const position = (dernier?.waitlistPosition ?? 0) + 1;

      await ecrire(tx, existante?.id, {
        sessionId,
        participantId,
        status: "WAITLISTED",
        waitlistPosition: position,
      });
      return { statut: "LISTE_ATTENTE" as const, position, titre: session.titleFr };
    },
    // Vingt candidats sérialisés sur un même verrou attendent leur tour : le
    // délai par défaut de 5 s les ferait échouer sur un faux motif.
    { timeout: 20_000, maxWait: 20_000 },
  );

  await audit.log({
    actorType: options.parPersonnel ? "USER" : "PARTICIPANT",
    actorUserId: options.actorUserId,
    actorParticipantId: options.parPersonnel ? undefined : participantId,
    action: "session_registration.create",
    entity: "Session",
    entityId: sessionId,
    after: { participantId, statut: resultat.statut },
  });

  return resultat.statut === "INSCRIT"
    ? { statut: "INSCRIT" }
    : { statut: "LISTE_ATTENTE", position: resultat.position };
}

/** Réactive une inscription annulée plutôt que d'en créer une seconde. */
async function ecrire(
  tx: Prisma.TransactionClient,
  existanteId: string | undefined,
  donnees: {
    sessionId: string;
    participantId: string;
    status: "REGISTERED" | "WAITLISTED";
    waitlistPosition: number | null;
  },
) {
  if (existanteId) {
    // `@@unique([sessionId, participantId])` interdit une seconde ligne : une
    // annulation suivie d'une nouvelle réservation réutilise donc la même.
    return tx.sessionRegistration.update({
      where: { id: existanteId },
      data: {
        status: donnees.status,
        waitlistPosition: donnees.waitlistPosition,
        registeredAt: new Date(),
        cancelledAt: null,
        promotedAt: null,
      },
    });
  }
  return tx.sessionRegistration.create({ data: donnees });
}

export interface ResultatAnnulation {
  /** Participant promu depuis la liste d'attente, s'il y en avait un. */
  promu: { participantId: string; email: string; sessionTitre: string } | null;
}

/**
 * Annulation, avec promotion du premier en liste d'attente.
 *
 * La promotion se fait **dans la même transaction et sous le même verrou** que
 * la libération de la place : entre les deux, une réservation concurrente
 * prendrait le siège que la liste d'attente attendait depuis trois semaines.
 *
 * La notification, elle, part **après** le commit : envoyer un courriel depuis
 * une transaction qui peut encore échouer annoncerait une place à quelqu'un qui
 * ne l'aurait pas.
 */
export async function annuler(
  sessionId: string,
  participantId: string,
  options: { parPersonnel?: boolean; actorUserId?: string } = {},
): Promise<ResultatAnnulation> {
  const resultat = await prisma.$transaction(
    async (tx) => {
      await verrouillerSession(tx, sessionId);

      const inscription = await tx.sessionRegistration.findUnique({
        where: { sessionId_participantId: { sessionId, participantId } },
        select: { id: true, status: true },
      });
      if (!inscription || inscription.status === "CANCELLED") {
        throw new RefusInscription("DEJA_INSCRIT", "Vous n'êtes pas inscrit à cette session.");
      }

      const liberaitUnePlace =
        inscription.status === "REGISTERED" || inscription.status === "ATTENDED";

      await tx.sessionRegistration.update({
        where: { id: inscription.id },
        data: { status: "CANCELLED", cancelledAt: new Date(), waitlistPosition: null },
      });

      if (!liberaitUnePlace) return { promu: null };

      const premier = await tx.sessionRegistration.findFirst({
        where: { sessionId, status: "WAITLISTED" },
        orderBy: { waitlistPosition: "asc" },
        select: { id: true, participantId: true },
      });
      if (!premier) return { promu: null };

      await tx.sessionRegistration.update({
        where: { id: premier.id },
        data: { status: "REGISTERED", waitlistPosition: null, promotedAt: new Date() },
      });

      const promu = await tx.participant.findUniqueOrThrow({
        where: { id: premier.participantId },
        select: { id: true, email: true },
      });
      const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        select: { titleFr: true },
      });

      return {
        promu: { participantId: promu.id, email: promu.email, sessionTitre: session.titleFr },
      };
    },
    { timeout: 20_000, maxWait: 20_000 },
  );

  await audit.log({
    actorType: options.parPersonnel ? "USER" : "PARTICIPANT",
    actorUserId: options.actorUserId,
    actorParticipantId: options.parPersonnel ? undefined : participantId,
    action: "session_registration.cancel",
    entity: "Session",
    entityId: sessionId,
    after: { participantId, promu: resultat.promu?.participantId ?? null },
  });

  return resultat;
}

export async function marquerPresent(
  sessionId: string,
  participantId: string,
  present: boolean,
  actorUserId?: string,
) {
  const inscription = await prisma.sessionRegistration.findUnique({
    where: { sessionId_participantId: { sessionId, participantId } },
    select: { id: true, status: true },
  });
  if (!inscription) {
    throw new RefusInscription("DEJA_INSCRIT", "Ce participant n'est pas inscrit à cette session.");
  }

  await prisma.sessionRegistration.update({
    where: { id: inscription.id },
    data: { status: present ? "ATTENDED" : "REGISTERED" },
  });

  await audit.log({
    actorType: "USER",
    actorUserId,
    action: present ? "session_registration.attended" : "session_registration.unattended",
    entity: "Session",
    entityId: sessionId,
    after: { participantId, present },
  });
}

export interface LigneInscription {
  participantId: string;
  publicId: string;
  nom: string;
  organisation: string | null;
  pays: string;
  categorie: string;
  statut: "REGISTERED" | "WAITLISTED" | "CANCELLED" | "ATTENDED";
  position: number | null;
  inscritLe: Date;
}

export async function listerInscriptions(sessionId: string): Promise<LigneInscription[]> {
  const lignes = await prisma.sessionRegistration.findMany({
    where: { sessionId },
    orderBy: [{ status: "asc" }, { waitlistPosition: "asc" }, { registeredAt: "asc" }],
    select: {
      status: true,
      waitlistPosition: true,
      registeredAt: true,
      participant: {
        select: {
          id: true,
          publicId: true,
          firstName: true,
          lastName: true,
          organization: true,
          country: true,
          category: { select: { labelFr: true } },
        },
      },
    },
  });

  return lignes.map((ligne) => ({
    participantId: ligne.participant.id,
    publicId: ligne.participant.publicId,
    nom: `${ligne.participant.lastName.toUpperCase()} ${ligne.participant.firstName}`,
    organisation: ligne.participant.organization,
    pays: ligne.participant.country,
    categorie: ligne.participant.category.labelFr,
    statut: ligne.status,
    position: ligne.waitlistPosition,
    inscritLe: ligne.registeredAt,
  }));
}
