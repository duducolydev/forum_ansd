import { Prisma, type ParticipantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Champs ciblés pour la liste BackOffice — un seul aller-retour, pas de N+1 (brief §3.3). */
const PARTICIPANT_LIST_SELECT = {
  id: true,
  publicId: true,
  civility: true,
  firstName: true,
  lastName: true,
  email: true,
  organization: true,
  country: true,
  status: true,
  source: true,
  createdAt: true,
  category: { select: { id: true, labelFr: true, labelEn: true, color: true } },
  delegation: { select: { id: true, name: true } },
  badges: {
    select: { version: true, revokedAt: true },
    orderBy: { version: "desc" as const },
    take: 1,
  },
} satisfies Prisma.ParticipantSelect;

export type ParticipantListItem = Prisma.ParticipantGetPayload<{
  select: typeof PARTICIPANT_LIST_SELECT;
}>;

export interface ParticipantListFilters {
  editionId: string;
  q?: string;
  status?: ParticipantStatus;
  categoryId?: string;
  country?: string;
  /** Journée déclarée (date ISO), ou `SANS_JOUR` pour ceux qui n'ont rien déclaré. */
  jour?: string;
  page: number;
  pageSize: number;
}

/** Valeur du filtre « journée » pour les dossiers sans déclaration. */
export const SANS_JOUR = "SANS";

/**
 * Filtre sur la journée déclarée (22 novembre 2026).
 *
 * `participationDays` est une colonne JSON : `array_contains` se traduit par un
 * `JSON_CONTAINS` côté MySQL, donc sans lire les lignes.
 *
 * Le cas « sans journée » demande trois conditions et non une : la colonne peut
 * valoir `NULL` en base (`DbNull`, un dossier créé au comptoir ou importé), le
 * littéral JSON `null` (`JsonNull`, écrit par une mise à jour), ou un tableau
 * vide. Les trois veulent dire la même chose pour qui lit l'écran, et n'en
 * traiter qu'une laisserait des dossiers invisibles des deux côtés du filtre.
 */
function filtreJour(jour: string): Prisma.ParticipantWhereInput {
  if (jour !== SANS_JOUR) return { participationDays: { array_contains: jour } };
  return {
    OR: [
      { participationDays: { equals: Prisma.DbNull } },
      { participationDays: { equals: Prisma.JsonNull } },
      { participationDays: { equals: [] } },
    ],
  };
}

/**
 * Les conditions qui portent un `OR` sont empilées dans un `AND` (22 novembre
 * 2026).
 *
 * La recherche libre et le filtre « sans journée déclarée » rendent chacun un
 * `OR`. Étalés dans le même objet, le second **écrasait** le premier sans rien
 * signaler : chercher un nom en filtrant « sans journée » aurait rendu tous les
 * homonymes, journée déclarée ou non. Les deux sont donc des conjonctions
 * explicites.
 */
function buildWhere(filters: ParticipantListFilters): Prisma.ParticipantWhereInput {
  const et: Prisma.ParticipantWhereInput[] = [];
  if (filters.jour) et.push(filtreJour(filters.jour));
  if (filters.q) {
    et.push({
      OR: [
        { firstName: { contains: filters.q } },
        { lastName: { contains: filters.q } },
        { email: { contains: filters.q } },
        { organization: { contains: filters.q } },
        { publicId: { contains: filters.q } },
      ],
    });
  }

  return {
    editionId: filters.editionId,
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.country ? { country: filters.country } : {}),
    ...(et.length > 0 ? { AND: et } : {}),
  };
}

export async function listParticipants(
  filters: ParticipantListFilters,
): Promise<{ items: ParticipantListItem[]; total: number }> {
  const where = buildWhere(filters);
  const [items, total] = await Promise.all([
    prisma.participant.findMany({
      where,
      select: PARTICIPANT_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.participant.count({ where }),
  ]);
  return { items, total };
}

export async function listCategories(editionId: string) {
  return prisma.participantCategory.findMany({
    where: { editionId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Catégories proposées au visiteur sur le formulaire d'inscription public :
 * actives **et** publiques. Une catégorie comme le comité d'organisation,
 * active mais non publique, ne s'attribue qu'en BackOffice (24 octobre 2026).
 */
export async function listPublicCategories(editionId: string) {
  return prisma.participantCategory.findMany({
    where: { editionId, isActive: true, isPublic: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function findParticipantById(id: string) {
  return prisma.participant.findUnique({
    where: { id },
    include: {
      category: true,
      delegation: true,
      badges: { orderBy: { version: "desc" } },
      invitation: true,
    },
  });
}

export async function findParticipantByEmail(editionId: string, email: string) {
  return prisma.participant.findUnique({
    where: { editionId_email: { editionId, email: email.toLowerCase() } },
  });
}

export async function createParticipant(data: Prisma.ParticipantCreateInput) {
  return prisma.participant.create({ data });
}

export async function updateParticipant(id: string, data: Prisma.ParticipantUpdateInput) {
  return prisma.participant.update({ where: { id }, data });
}

// ---------------------------------------------------------------------------
// Délégations
// ---------------------------------------------------------------------------

export async function listDelegations(editionId: string) {
  return prisma.delegation.findMany({
    where: { editionId },
    include: {
      headParticipant: { select: { id: true, civility: true, firstName: true, lastName: true } },
      referent: { select: { id: true, name: true, email: true, phone: true, role: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function findDelegationById(id: string) {
  return prisma.delegation.findUnique({
    where: { id },
    include: {
      headParticipant: { select: { id: true, civility: true, firstName: true, lastName: true } },
      referent: { select: { id: true, name: true, email: true, phone: true, role: true } },
      members: {
        select: {
          id: true,
          publicId: true,
          civility: true,
          firstName: true,
          lastName: true,
          status: true,
        },
        orderBy: { lastName: "asc" },
      },
    },
  });
}

export async function createDelegation(data: Prisma.DelegationCreateInput) {
  return prisma.delegation.create({ data });
}

export async function updateDelegation(id: string, data: Prisma.DelegationUpdateInput) {
  return prisma.delegation.update({ where: { id }, data });
}
