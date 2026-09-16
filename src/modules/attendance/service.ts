import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Présences (brief §5.6).
 *
 * Une présence est un **scan autorisé en entrée** : `result = OK` et
 * `direction = IN`. Les refus sont comptés à part — ils disent quelque chose du
 * jour J (mauvaise salle, badge périmé) mais ne sont pas des présences.
 *
 * Le scan de sortie est facultatif dans le brief (§2.5) et n'est pas déployé.
 * On ne prétend donc **pas** connaître le nombre de personnes présentes dans une
 * zone à l'instant t : sans sortie, ce chiffre ne ferait que croître et
 * donnerait une fausse assurance à qui doit décider d'ouvrir une salle. Ce qui
 * est mesuré, et affiché sous ce nom, est l'**affluence** — le nombre de
 * personnes distinctes passées par la zone dans la journée.
 */

export interface KpisPresence {
  presents: number;
  attendus: number;
  taux: number | null;
  scans: number;
  refus: number;
}

export interface LignePoint {
  checkpointId: string;
  nom: string;
  zone: string;
  autorises: number;
  refuses: number;
  dejaScannes: number;
}

export interface LigneZone {
  zone: string;
  affluence: number;
}

export interface LigneTaux {
  libelle: string;
  presents: number;
  attendus: number;
  taux: number;
}

export interface LigneFlux {
  id: string;
  scanneA: Date;
  nom: string | null;
  publicId: string | null;
  categorie: string | null;
  point: string;
  zone: string;
  resultat: string;
}

export interface PresenceDuJour {
  jour: Date;
  kpis: KpisPresence;
  parPoint: LignePoint[];
  parZone: LigneZone[];
  parCategorie: LigneTaux[];
  parPays: LigneTaux[];
}

/** Statuts comptés comme « attendus » : ceux qui ont vocation à se présenter. */
const STATUTS_ATTENDUS = ["CONFIRMED", "BADGED", "CHECKED_IN"] as const;

function debutDeJour(jour: Date): Date {
  return new Date(Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth(), jour.getUTCDate()));
}

/** Jours pour lesquels au moins un scan existe, du plus récent au plus ancien. */
export async function listerJours(editionId: string): Promise<Date[]> {
  const lignes = await prisma.scanLog.findMany({
    where: { checkpoint: { editionId } },
    distinct: ["day"],
    orderBy: { day: "desc" },
    select: { day: true },
  });
  return lignes.map((ligne) => ligne.day);
}

export async function getPresenceDuJour(editionId: string, jour: Date): Promise<PresenceDuJour> {
  const day = debutDeJour(jour);
  const perimetre = { checkpoint: { editionId }, day };

  const [scans, refus, presentsIds, attendus, parPointBrut, points] = await Promise.all([
    prisma.scanLog.count({ where: perimetre }),
    prisma.scanLog.count({
      where: {
        ...perimetre,
        result: { in: ["DENIED_ZONE", "DENIED_STATUS", "REVOKED", "UNKNOWN"] },
      },
    }),
    prisma.scanLog.findMany({
      where: { ...perimetre, result: "OK", direction: "IN", participantId: { not: null } },
      distinct: ["participantId"],
      select: { participantId: true },
    }),
    prisma.participant.count({
      where: { editionId, deletedAt: null, status: { in: [...STATUTS_ATTENDUS] } },
    }),
    prisma.scanLog.groupBy({
      by: ["checkpointId", "result"],
      where: perimetre,
      _count: { _all: true },
    }),
    prisma.checkpoint.findMany({
      where: { editionId },
      select: { id: true, name: true, zone: { select: { code: true, name: true } } },
    }),
  ]);

  const presents = presentsIds.length;

  const parPoint: LignePoint[] = points
    .map((point) => {
      const lignes = parPointBrut.filter((ligne) => ligne.checkpointId === point.id);
      const compter = (resultats: string[]) =>
        lignes
          .filter((ligne) => resultats.includes(ligne.result))
          .reduce((total, ligne) => total + ligne._count._all, 0);

      return {
        checkpointId: point.id,
        nom: point.name,
        zone: point.zone.name,
        autorises: compter(["OK"]),
        refuses: compter(["DENIED_ZONE", "DENIED_STATUS", "REVOKED", "UNKNOWN"]),
        dejaScannes: compter(["ALREADY"]),
      };
    })
    .filter((ligne) => ligne.autorises + ligne.refuses + ligne.dejaScannes > 0)
    .sort((a, b) => b.autorises - a.autorises);

  const [parZone, parCategorie, parPays] = await Promise.all([
    affluenceParZone(editionId, day),
    tauxParChamp(editionId, day, "categorie"),
    tauxParChamp(editionId, day, "pays"),
  ]);

  return {
    jour: day,
    kpis: {
      presents,
      attendus,
      taux: attendus === 0 ? null : Math.round((presents / attendus) * 1000) / 10,
      scans,
      refus,
    },
    parPoint,
    parZone,
    parCategorie,
    parPays,
  };
}

/**
 * Affluence par zone : personnes **distinctes** passées, pas nombre de scans.
 *
 * SQL brut parce qu'il faut un `COUNT(DISTINCT …)` sur une jointure, que Prisma
 * n'exprime pas. Même exception, localisée et commentée, que pour la courbe du
 * tableau de bord.
 */
async function affluenceParZone(editionId: string, day: Date): Promise<LigneZone[]> {
  const lignes = await prisma.$queryRaw<{ zone: string; affluence: bigint }[]>`
    SELECT z.name AS zone, COUNT(DISTINCT s.participantId) AS affluence
    FROM ScanLog s
    JOIN Checkpoint c ON c.id = s.checkpointId
    JOIN Zone z ON z.id = c.zoneId
    WHERE c.editionId = ${editionId}
      AND s.day = ${day}
      AND s.result = 'OK'
      AND s.direction = 'IN'
      AND s.participantId IS NOT NULL
    GROUP BY z.id, z.name
    ORDER BY affluence DESC
  `;
  return lignes.map((ligne) => ({ zone: ligne.zone, affluence: Number(ligne.affluence) }));
}

/**
 * Taux de présence par catégorie ou par pays (brief §5.6).
 *
 * Les deux populations sont comptées dans la **même** requête : présents d'un
 * côté, attendus de l'autre. Les compter séparément puis les rapprocher en
 * mémoire produirait des taux supérieurs à 100 % dès qu'un participant change
 * de catégorie entre les deux lectures.
 */
async function tauxParChamp(
  editionId: string,
  day: Date,
  champ: "categorie" | "pays",
): Promise<LigneTaux[]> {
  const libelle =
    champ === "categorie" ? Prisma.sql`cat.labelFr` : Prisma.sql`COALESCE(p.country, '—')`;
  const groupe = champ === "categorie" ? Prisma.sql`cat.id, cat.labelFr` : Prisma.sql`p.country`;
  const jointure =
    champ === "categorie"
      ? Prisma.sql`JOIN ParticipantCategory cat ON cat.id = p.categoryId`
      : Prisma.empty;

  const lignes = await prisma.$queryRaw<{ libelle: string; presents: bigint; attendus: bigint }[]>`
    SELECT ${libelle} AS libelle,
           COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN p.id END) AS presents,
           COUNT(DISTINCT p.id) AS attendus
    FROM Participant p
    ${jointure}
    LEFT JOIN ScanLog s
      ON s.participantId = p.id
     AND s.day = ${day}
     AND s.result = 'OK'
     AND s.direction = 'IN'
    WHERE p.editionId = ${editionId}
      AND p.deletedAt IS NULL
      AND p.status IN ('CONFIRMED', 'BADGED', 'CHECKED_IN')
    GROUP BY ${groupe}
    ORDER BY presents DESC, attendus DESC
  `;

  return lignes.map((ligne) => {
    const presents = Number(ligne.presents);
    const attendus = Number(ligne.attendus);
    return {
      libelle: ligne.libelle,
      presents,
      attendus,
      taux: attendus === 0 ? 0 : Math.round((presents / attendus) * 1000) / 10,
    };
  });
}

/**
 * Derniers scans, pour le flux du jour J.
 *
 * Interrogation périodique plutôt que SSE (le brief laisse le choix) : une
 * connexion longue derrière un proxy inverse demande de désactiver la
 * bufferisation et survit mal aux redémarrages, pour un écran que deux ou trois
 * personnes regardent. Un appel toutes les cinq secondes est négligeable et ne
 * dépend d'aucun réglage d'infrastructure.
 */
export async function getFluxRecent(editionId: string, limite = 25): Promise<LigneFlux[]> {
  const lignes = await prisma.scanLog.findMany({
    where: { checkpoint: { editionId } },
    orderBy: { scannedAt: "desc" },
    take: limite,
    select: {
      id: true,
      scannedAt: true,
      result: true,
      checkpoint: { select: { name: true, zone: { select: { name: true } } } },
      participant: {
        select: {
          publicId: true,
          firstName: true,
          lastName: true,
          category: { select: { labelFr: true } },
        },
      },
    },
  });

  return lignes.map((ligne) => ({
    id: ligne.id,
    scanneA: ligne.scannedAt,
    nom: ligne.participant ? `${ligne.participant.firstName} ${ligne.participant.lastName}` : null,
    publicId: ligne.participant?.publicId ?? null,
    categorie: ligne.participant?.category.labelFr ?? null,
    point: ligne.checkpoint.name,
    zone: ligne.checkpoint.zone.name,
    resultat: ligne.result,
  }));
}

// ---------------------------------------------------------------------------
// Listes exportables
// ---------------------------------------------------------------------------

export interface LigneListe {
  publicId: string;
  nom: string;
  organisation: string | null;
  categorie: string;
  pays: string;
  /** Heure du premier passage autorisé du jour, ou `null` si absent. */
  premierPassage: Date | null;
}

export interface FiltresListe {
  jour: Date;
  categoryId?: string;
  zoneId?: string;
}

/**
 * Liste nominative pour l'export.
 *
 * Renvoie **tous les attendus**, présents ou non, avec l'heure du premier
 * passage quand elle existe. C'est ce qui permet de produire aussi bien la
 * feuille d'émargement (colonne signature, avant l'événement) que la liste de
 * présence constatée (heures, après) à partir d'une seule requête — et surtout
 * de voir qui manque, ce qu'une liste des seuls présents ne dirait pas.
 */
export async function getListePresence(
  editionId: string,
  filtres: FiltresListe,
): Promise<LigneListe[]> {
  const day = debutDeJour(filtres.jour);

  const participants = await prisma.participant.findMany({
    where: {
      editionId,
      deletedAt: null,
      status: { in: [...STATUTS_ATTENDUS] },
      ...(filtres.categoryId ? { categoryId: filtres.categoryId } : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      organization: true,
      country: true,
      category: { select: { labelFr: true } },
      scanLogs: {
        where: {
          day,
          result: "OK",
          direction: "IN",
          ...(filtres.zoneId ? { checkpoint: { zoneId: filtres.zoneId } } : {}),
        },
        orderBy: { scannedAt: "asc" },
        take: 1,
        select: { scannedAt: true },
      },
    },
  });

  return participants.map((participant) => ({
    publicId: participant.publicId,
    nom: `${participant.lastName.toUpperCase()} ${participant.firstName}`,
    organisation: participant.organization,
    categorie: participant.category.labelFr,
    pays: participant.country,
    premierPassage: participant.scanLogs[0]?.scannedAt ?? null,
  }));
}
