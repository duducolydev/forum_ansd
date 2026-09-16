import { Prisma, type ParticipantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Agrégats du tableau de bord (brief §13).
 *
 * Tout passe par des `groupBy` : un tableau de bord qui empile vingt `count()`
 * distincts devient le point lent du BackOffice dès quelques milliers de
 * participants. Ici, une poignée de requêtes suffit et les recoupements se font
 * en mémoire.
 */

/** Un participant est « inscrit » dès qu'il a complété le formulaire. */
const REGISTERED_STATUSES: ParticipantStatus[] = [
  "REGISTERED",
  "CONFIRMED",
  "BADGED",
  "CHECKED_IN",
];
/** « Confirmé » = validé par le comité, badge émis ou non. */
const CONFIRMED_STATUSES: ParticipantStatus[] = ["CONFIRMED", "BADGED", "CHECKED_IN"];

/** Pays hôte : sert à distinguer participants nationaux et internationaux. */
const HOST_COUNTRY = "Sénégal";

export interface DashboardKpis {
  registered: number;
  confirmed: number;
  invited: number;
  national: number;
  international: number;
  vip: number;
  media: number;
  badgesGenerated: number;
  /** Confirmés / inscrits, en pourcentage entier. `null` si aucun inscrit. */
  confirmationRate: number | null;
}

export interface FunnelStage {
  label: string;
  value: number;
}

export interface Breakdown {
  label: string;
  value: number;
}

export interface DailyPoint {
  day: string;
  value: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  funnel: FunnelStage[];
  byCountry: Breakdown[];
  byCategory: Breakdown[];
  byOrganization: Breakdown[];
  registrationsPerDay: DailyPoint[];
  totalParticipants: number;
}

function sum(rows: { _count: { _all: number } }[]): number {
  return rows.reduce((total, row) => total + row._count._all, 0);
}

export async function getDashboardData(editionId: string): Promise<DashboardData> {
  const scope = { editionId, deletedAt: null } as const;

  const [
    byStatus,
    byCategoryRow,
    byCountryRow,
    byOrganizationRow,
    categories,
    invitationsByStatus,
  ] = await Promise.all([
    prisma.participant.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.participant.groupBy({
      by: ["categoryId"],
      where: { ...scope, status: { in: REGISTERED_STATUSES } },
      _count: { _all: true },
    }),
    prisma.participant.groupBy({
      by: ["country"],
      where: { ...scope, status: { in: REGISTERED_STATUSES } },
      _count: { _all: true },
    }),
    prisma.participant.groupBy({
      by: ["organization"],
      where: { ...scope, status: { in: REGISTERED_STATUSES } },
      _count: { _all: true },
    }),
    prisma.participantCategory.findMany({
      where: { editionId },
      select: { id: true, code: true, labelFr: true, sortOrder: true },
    }),
    prisma.invitation.groupBy({ by: ["status"], where: { editionId }, _count: { _all: true } }),
  ]);

  const statusCount = new Map(byStatus.map((row) => [row.status, row._count._all]));
  const countOf = (statuses: ParticipantStatus[]) =>
    statuses.reduce((total, status) => total + (statusCount.get(status) ?? 0), 0);

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const countByCode = (code: string) =>
    byCategoryRow
      .filter((row) => categoryById.get(row.categoryId)?.code === code)
      .reduce((total, row) => total + row._count._all, 0);

  const registered = countOf(REGISTERED_STATUSES);
  const confirmed = countOf(CONFIRMED_STATUSES);

  const national = byCountryRow
    .filter((row) => row.country === HOST_COUNTRY)
    .reduce((total, row) => total + row._count._all, 0);

  // Badges effectivement produits, révocations exclues : c'est le nombre de
  // badges valides en circulation, pas le nombre de rendus effectués.
  const badgesGenerated = await prisma.badge.count({
    where: { generatedAt: { not: null }, revokedAt: null, participant: scope },
  });

  const invited = sum(invitationsByStatus);

  /*
   * Entonnoir : **une seule population**, celle des personnes réellement
   * invitées. Enchaîner « invitations envoyées » puis « inscrits » tous
   * confondus mélangeait deux ensembles — les inscriptions spontanées faisaient
   * dépasser l'étape « inscrits » au-dessus de « envoyées », et le taux de
   * passage affiché aurait dépassé 100 %. Chaque étape est ici un sous-ensemble
   * strict de la précédente, donc décroissante par construction.
   */
  const invitedScope = { ...scope, invitation: { sentAt: { not: null } } };
  const [invitationsSent, invitedRegistered, invitedConfirmed, invitedBadged] = await Promise.all([
    prisma.invitation.count({ where: { editionId, sentAt: { not: null } } }),
    prisma.participant.count({ where: { ...invitedScope, status: { in: REGISTERED_STATUSES } } }),
    prisma.participant.count({ where: { ...invitedScope, status: { in: CONFIRMED_STATUSES } } }),
    prisma.participant.count({
      where: { ...invitedScope, status: { in: ["BADGED", "CHECKED_IN"] } },
    }),
  ]);

  return {
    totalParticipants: sum(byStatus),
    kpis: {
      registered,
      confirmed,
      invited,
      national,
      international: registered - national,
      vip: countByCode("AUTORITE_VIP"),
      media: countByCode("MEDIA"),
      badgesGenerated,
      confirmationRate: registered > 0 ? Math.round((confirmed / registered) * 100) : null,
    },
    funnel: [
      { label: "Invitations créées", value: invited },
      { label: "Envoyées", value: invitationsSent },
      { label: "Inscrits", value: invitedRegistered },
      { label: "Confirmés", value: invitedConfirmed },
      { label: "Badgés", value: invitedBadged },
    ],
    byCountry: topBreakdown(
      byCountryRow.map((row) => ({ label: row.country, value: row._count._all })),
    ),
    byCategory: byCategoryRow
      .map((row) => ({
        label: categoryById.get(row.categoryId)?.labelFr ?? "—",
        value: row._count._all,
        sortOrder: categoryById.get(row.categoryId)?.sortOrder ?? 0,
      }))
      .sort((a, b) => b.value - a.value || a.sortOrder - b.sortOrder)
      .map(({ label, value }) => ({ label, value })),
    byOrganization: topBreakdown(
      byOrganizationRow
        .filter((row) => row.organization)
        .map((row) => ({ label: row.organization!, value: row._count._all })),
    ),
    registrationsPerDay: await getRegistrationsPerDay(editionId),
  };
}

/**
 * Huit lignes au plus, le reste replié dans « Autres » : au-delà, les barres
 * deviennent illisibles et la carte s'allonge sans rien apprendre.
 */
export function topBreakdown(rows: Breakdown[], limit = 8): Breakdown[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;

  const head = sorted.slice(0, limit);
  const rest = sorted.slice(limit).reduce((total, row) => total + row.value, 0);
  return rest > 0 ? [...head, { label: `Autres (${sorted.length - limit})`, value: rest }] : head;
}

/**
 * Inscriptions par jour. En SQL brut car Prisma ne sait pas grouper sur une
 * expression (`DATE(registeredAt)`) — seulement sur des colonnes.
 *
 * Le filtre de statut est **le même que celui de l'indicateur « Inscrits »** :
 * sans lui, la courbe comptait aussi les participations déclinées ou annulées
 * et totalisait 18 là où la tuile affichait 16. Deux chiffres divergents sur un
 * même écran suffisent à faire douter de tout le tableau de bord.
 */
async function getRegistrationsPerDay(editionId: string): Promise<DailyPoint[]> {
  const rows = await prisma.$queryRaw<{ day: Date | string; total: bigint | number }[]>`
    SELECT DATE(registeredAt) AS day, COUNT(*) AS total
    FROM Participant
    WHERE editionId = ${editionId}
      AND deletedAt IS NULL
      AND registeredAt IS NOT NULL
      AND status IN (${Prisma.join(REGISTERED_STATUSES)})
    GROUP BY DATE(registeredAt)
    ORDER BY day ASC
  `;

  return rows.map((row) => ({
    day:
      row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
    value: Number(row.total),
  }));
}
