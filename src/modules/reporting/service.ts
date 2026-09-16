import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { calculerPlaces } from "@/modules/sessions/service";

/**
 * Catalogue des rapports (brief §5.13).
 *
 * **Interprétation à faire confirmer par l'ANSD** : le brief renvoie aux
 * « rapports listés §23 » de la spécification fonctionnelle, dont le contenu
 * détaillé ne nous est pas parvenu sous une forme exploitable. Le catalogue
 * ci-dessous couvre ce que les données permettent et ce que les autres sections
 * du brief nomment explicitement — participants, présences, remplissage des
 * sessions, entonnoir, délégations, badges. Ajouter un rapport tient en une
 * entrée de ce tableau ; en retirer un aussi.
 *
 * Chaque rapport se décrit par ses colonnes et une fonction de lignes : les
 * formats (CSV, XLSX, PDF) n'en savent rien d'autre, ce qui évite d'avoir trois
 * requêtes légèrement différentes pour un même chiffre.
 */

export interface Rapport {
  cle: string;
  titre: string;
  description: string;
  colonnes: string[];
  lignes: (editionId: string) => Promise<(string | number)[][]>;
}

const dateCourte = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "UTC" });
const heureCourte = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});

const STATUT_LABELS: Record<string, string> = {
  INVITED: "Invité",
  INVITATION_SENT: "Invitation envoyée",
  REGISTRATION_STARTED: "Inscription commencée",
  REGISTERED: "Inscrit",
  CONFIRMED: "Confirmé",
  BADGED: "Badge émis",
  CHECKED_IN: "Présent",
  DECLINED: "Décliné",
  CANCELLED: "Annulé",
};

const participants: Rapport = {
  cle: "participants",
  titre: "Participants",
  description: "Tous les participants de l'édition, avec leur statut et leur rattachement.",
  colonnes: [
    "Identifiant",
    "Civilité",
    "Nom",
    "Prénom",
    "E-mail",
    "Téléphone",
    "Organisation",
    "Fonction",
    "Pays",
    "Catégorie",
    "Délégation",
    "Statut",
    "Source",
    "Inscrit le",
    "Confirmé le",
  ],
  async lignes(editionId) {
    const lignes = await prisma.participant.findMany({
      where: { editionId, deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        publicId: true,
        civility: true,
        lastName: true,
        firstName: true,
        email: true,
        phone: true,
        organization: true,
        jobTitle: true,
        country: true,
        status: true,
        source: true,
        registeredAt: true,
        confirmedAt: true,
        category: { select: { labelFr: true } },
        delegation: { select: { name: true } },
      },
    });

    return lignes.map((ligne) => [
      ligne.publicId,
      ligne.civility ?? "",
      ligne.lastName.toUpperCase(),
      ligne.firstName,
      ligne.email,
      ligne.phone ?? "",
      ligne.organization ?? "",
      ligne.jobTitle ?? "",
      ligne.country,
      ligne.category.labelFr,
      ligne.delegation?.name ?? "",
      STATUT_LABELS[ligne.status] ?? ligne.status,
      ligne.source,
      ligne.registeredAt ? dateCourte.format(ligne.registeredAt) : "",
      ligne.confirmedAt ? dateCourte.format(ligne.confirmedAt) : "",
    ]);
  },
};

const presences: Rapport = {
  cle: "presences",
  titre: "Présences",
  description: "Un passage autorisé par ligne : qui, quand, à quel point de contrôle.",
  colonnes: ["Jour", "Heure", "Identifiant", "Nom", "Catégorie", "Point de contrôle", "Zone"],
  async lignes(editionId) {
    const lignes = await prisma.scanLog.findMany({
      where: { checkpoint: { editionId }, result: "OK", direction: "IN" },
      orderBy: [{ day: "asc" }, { scannedAt: "asc" }],
      select: {
        day: true,
        scannedAt: true,
        participant: {
          select: {
            publicId: true,
            firstName: true,
            lastName: true,
            category: { select: { labelFr: true } },
          },
        },
        checkpoint: { select: { name: true, zone: { select: { name: true } } } },
      },
    });

    return lignes.map((ligne) => [
      dateCourte.format(ligne.day),
      heureCourte.format(ligne.scannedAt),
      ligne.participant?.publicId ?? "",
      ligne.participant
        ? `${ligne.participant.lastName.toUpperCase()} ${ligne.participant.firstName}`
        : "Badge inconnu",
      ligne.participant?.category.labelFr ?? "",
      ligne.checkpoint.name,
      ligne.checkpoint.zone.name,
    ]);
  },
};

const remplissageSessions: Rapport = {
  cle: "sessions",
  titre: "Remplissage des sessions",
  description: "Inscrits, liste d'attente et présents par session, rapportés à la capacité.",
  colonnes: [
    "Jour",
    "Horaire",
    "Session",
    "Salle",
    "Capacité",
    "Inscrits",
    "Liste d'attente",
    "Présents",
    "Taux de remplissage",
    "État",
  ],
  async lignes(editionId) {
    const sessions = await prisma.session.findMany({
      where: { editionId, deletedAt: null },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
      select: {
        titleFr: true,
        day: true,
        startTime: true,
        endTime: true,
        capacity: true,
        registrationOpen: true,
        registrationDeadline: true,
        waitlistEnabled: true,
        room: { select: { name: true } },
        registrations: { select: { status: true } },
      },
    });

    const heure = (date: Date) =>
      `${String(date.getUTCHours()).padStart(2, "0")}h${String(date.getUTCMinutes()).padStart(2, "0")}`;

    return sessions.map((session) => {
      const inscrits = session.registrations.filter(
        (inscription) => inscription.status === "REGISTERED" || inscription.status === "ATTENDED",
      ).length;
      const attente = session.registrations.filter(
        (inscription) => inscription.status === "WAITLISTED",
      ).length;
      const presents = session.registrations.filter(
        (inscription) => inscription.status === "ATTENDED",
      ).length;

      // Le même calcul que la page publique et le BackOffice : un rapport qui
      // dirait « complet » là où le site dit « ouvert » serait ingérable.
      const places = calculerPlaces(session, { inscrits, attente });

      return [
        dateCourte.format(session.day),
        `${heure(session.startTime)}–${heure(session.endTime)}`,
        session.titleFr,
        session.room?.name ?? "",
        session.capacity ?? "",
        inscrits,
        attente,
        presents,
        session.capacity ? `${Math.round((inscrits / session.capacity) * 100)} %` : "",
        places.etat,
      ];
    });
  },
};

const entonnoir: Rapport = {
  cle: "entonnoir",
  titre: "Entonnoir invitation → présence",
  description:
    "Parcours des personnes invitées, étape par étape. Les inscriptions spontanées n'y figurent pas.",
  colonnes: ["Étape", "Effectif", "Part de l'étape précédente"],
  async lignes(editionId) {
    // Restreint aux invités, comme au tableau de bord : mêler les inscriptions
    // spontanées produirait un entonnoir qui remonte.
    const invites = { editionId, deletedAt: null, invitation: { sentAt: { not: null } } };

    const [invitees, inscrits, confirmes, badges, presents] = await Promise.all([
      prisma.participant.count({ where: invites }),
      prisma.participant.count({
        where: {
          ...invites,
          status: { in: ["REGISTERED", "CONFIRMED", "BADGED", "CHECKED_IN"] },
        },
      }),
      prisma.participant.count({
        where: { ...invites, status: { in: ["CONFIRMED", "BADGED", "CHECKED_IN"] } },
      }),
      prisma.participant.count({
        where: { ...invites, status: { in: ["BADGED", "CHECKED_IN"] } },
      }),
      prisma.participant.count({ where: { ...invites, status: "CHECKED_IN" } }),
    ]);

    const etapes: [string, number][] = [
      ["Invitations envoyées", invitees],
      ["Inscrits", inscrits],
      ["Confirmés", confirmes],
      ["Badge émis", badges],
      ["Présents", presents],
    ];

    return etapes.map(([libelle, effectif], index) => {
      const precedent = index === 0 ? effectif : etapes[index - 1]![1];
      return [
        libelle,
        effectif,
        precedent === 0 ? "—" : `${Math.round((effectif / precedent) * 100)} %`,
      ];
    });
  },
};

const delegations: Rapport = {
  cle: "delegations",
  titre: "Délégations",
  description: "Effectif de chaque délégation, du confirmé au présent.",
  colonnes: ["Délégation", "Pays", "Institution", "Membres", "Confirmés", "Présents"],
  async lignes(editionId) {
    const lignes = await prisma.delegation.findMany({
      where: { editionId },
      orderBy: { name: "asc" },
      select: {
        name: true,
        country: true,
        institution: true,
        members: { select: { status: true } },
      },
    });

    return lignes.map((ligne) => [
      ligne.name,
      ligne.country ?? "",
      ligne.institution ?? "",
      ligne.members.length,
      ligne.members.filter((membre) =>
        ["CONFIRMED", "BADGED", "CHECKED_IN"].includes(membre.status),
      ).length,
      ligne.members.filter((membre) => membre.status === "CHECKED_IN").length,
    ]);
  },
};

const badges: Rapport = {
  cle: "badges",
  titre: "Badges",
  description: "État de chaque badge émis, avec le nombre d'impressions.",
  colonnes: [
    "Identifiant",
    "Nom",
    "Catégorie",
    "Délégation",
    "Version",
    "Généré le",
    "Révoqué",
    "Motif de révocation",
    "Impressions",
  ],
  async lignes(editionId) {
    const lignes = await prisma.badge.findMany({
      where: { participant: { editionId, deletedAt: null } },
      orderBy: [{ participant: { lastName: "asc" } }, { version: "asc" }],
      select: {
        version: true,
        generatedAt: true,
        revokedAt: true,
        revokeReason: true,
        printedCount: true,
        participant: {
          select: {
            publicId: true,
            firstName: true,
            lastName: true,
            category: { select: { labelFr: true } },
            delegation: { select: { name: true } },
          },
        },
      },
    });

    return lignes.map((ligne) => [
      ligne.participant.publicId,
      `${ligne.participant.lastName.toUpperCase()} ${ligne.participant.firstName}`,
      ligne.participant.category.labelFr,
      ligne.participant.delegation?.name ?? "",
      ligne.version,
      ligne.generatedAt ? heureCourte.format(ligne.generatedAt) : "",
      ligne.revokedAt ? "Oui" : "Non",
      ligne.revokeReason ?? "",
      ligne.printedCount,
    ]);
  },
};

const repartition: Rapport = {
  cle: "repartition",
  titre: "Répartition",
  description: "Effectifs par pays et par catégorie, pour les inscrits et au-delà.",
  colonnes: ["Dimension", "Valeur", "Inscrits", "Confirmés", "Présents"],
  async lignes(editionId) {
    // Une seule requête par dimension, présents et inscrits comptés ensemble :
    // les compter séparément fait diverger les totaux dès qu'une donnée change
    // entre les deux lectures.
    const compter = async (champ: "pays" | "categorie") => {
      const libelle =
        champ === "pays" ? Prisma.sql`COALESCE(p.country, '—')` : Prisma.sql`cat.labelFr`;
      const groupe = champ === "pays" ? Prisma.sql`p.country` : Prisma.sql`cat.id, cat.labelFr`;
      const jointure =
        champ === "categorie"
          ? Prisma.sql`JOIN ParticipantCategory cat ON cat.id = p.categoryId`
          : Prisma.empty;

      return prisma.$queryRaw<
        { libelle: string; inscrits: bigint; confirmes: bigint; presents: bigint }[]
      >`
        SELECT ${libelle} AS libelle,
               COUNT(*) AS inscrits,
               SUM(p.status IN ('CONFIRMED','BADGED','CHECKED_IN')) AS confirmes,
               SUM(p.status = 'CHECKED_IN') AS presents
        FROM Participant p
        ${jointure}
        WHERE p.editionId = ${editionId}
          AND p.deletedAt IS NULL
          AND p.status IN ('REGISTERED','CONFIRMED','BADGED','CHECKED_IN')
        GROUP BY ${groupe}
        ORDER BY inscrits DESC
      `;
    };

    const [pays, categories] = await Promise.all([compter("pays"), compter("categorie")]);

    return [
      ...pays.map((ligne) => [
        "Pays",
        ligne.libelle,
        Number(ligne.inscrits),
        Number(ligne.confirmes),
        Number(ligne.presents),
      ]),
      ...categories.map((ligne) => [
        "Catégorie",
        ligne.libelle,
        Number(ligne.inscrits),
        Number(ligne.confirmes),
        Number(ligne.presents),
      ]),
    ];
  },
};

export const RAPPORTS: Rapport[] = [
  participants,
  presences,
  remplissageSessions,
  entonnoir,
  repartition,
  delegations,
  badges,
];

export function trouverRapport(cle: string): Rapport | undefined {
  return RAPPORTS.find((rapport) => rapport.cle === cle);
}
