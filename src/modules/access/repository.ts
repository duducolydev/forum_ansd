import { prisma } from "@/lib/db";

export async function listZones(editionId: string) {
  return prisma.zone.findMany({
    where: { editionId },
    orderBy: { code: "asc" },
    include: { _count: { select: { checkpoints: true, categoryZones: true, overrides: true } } },
  });
}

export async function findZone(id: string) {
  return prisma.zone.findUnique({ where: { id } });
}

export async function findZoneWithCounts(id: string) {
  return prisma.zone.findUnique({
    where: { id },
    include: { _count: { select: { checkpoints: true, categoryZones: true, overrides: true } } },
  });
}

export async function createZone(editionId: string, data: Omit<ZoneRow, "id">) {
  return prisma.zone.create({ data: { ...data, editionId } });
}

export async function updateZone(id: string, data: Omit<ZoneRow, "id">) {
  return prisma.zone.update({ where: { id }, data });
}

export async function deleteZone(id: string) {
  return prisma.zone.delete({ where: { id } });
}

interface ZoneRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

// ---------------------------------------------------------------------------
// Points de contrôle
// ---------------------------------------------------------------------------

export async function listCheckpoints(editionId: string) {
  return prisma.checkpoint.findMany({
    where: { editionId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      zone: { select: { id: true, code: true, name: true } },
      _count: { select: { scanLogs: true } },
    },
  });
}

export async function createCheckpoint(
  editionId: string,
  data: { name: string; zoneId: string; deviceLabel: string | null; isActive: boolean },
) {
  return prisma.checkpoint.create({ data: { ...data, editionId } });
}

export async function updateCheckpoint(
  id: string,
  data: { name: string; zoneId: string; deviceLabel: string | null; isActive: boolean },
) {
  return prisma.checkpoint.update({ where: { id }, data });
}

export async function deleteCheckpoint(id: string) {
  return prisma.checkpoint.delete({ where: { id } });
}

export async function countScans(checkpointId: string) {
  return prisma.scanLog.count({ where: { checkpointId } });
}

// ---------------------------------------------------------------------------
// Matrice catégorie × zone
// ---------------------------------------------------------------------------

export async function listCategories(editionId: string) {
  return prisma.participantCategory.findMany({
    where: { editionId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, labelFr: true, alertOnScan: true },
  });
}

export async function setCategoryAlert(categoryId: string, alertOnScan: boolean) {
  return prisma.participantCategory.update({ where: { id: categoryId }, data: { alertOnScan } });
}

export async function listMatrixPairs(editionId: string) {
  return prisma.categoryZone.findMany({
    where: { zone: { editionId } },
    select: { categoryId: true, zoneId: true },
  });
}

export async function allowCell(categoryId: string, zoneId: string) {
  return prisma.categoryZone.upsert({
    where: { categoryId_zoneId: { categoryId, zoneId } },
    update: {},
    create: { categoryId, zoneId },
  });
}

export async function denyCell(categoryId: string, zoneId: string) {
  return prisma.categoryZone.deleteMany({ where: { categoryId, zoneId } });
}

// ---------------------------------------------------------------------------
// Exceptions individuelles
// ---------------------------------------------------------------------------

export async function listOverrides(editionId: string) {
  return prisma.participantZoneOverride.findMany({
    where: { zone: { editionId } },
    orderBy: { createdAt: "desc" },
    include: {
      zone: { select: { code: true, name: true } },
      participant: {
        select: { id: true, publicId: true, firstName: true, lastName: true, organization: true },
      },
      grantedBy: { select: { name: true } },
    },
  });
}

export async function findParticipantByPublicId(editionId: string, publicId: string) {
  return prisma.participant.findFirst({
    where: { editionId, publicId },
    select: { id: true, publicId: true, firstName: true, lastName: true },
  });
}

export async function createOverride(data: {
  participantId: string;
  zoneId: string;
  grantedById?: string;
  reason: string;
}) {
  return prisma.participantZoneOverride.create({ data });
}

export async function findOverride(id: string) {
  return prisma.participantZoneOverride.findUnique({
    where: { id },
    include: { zone: { select: { code: true } }, participant: { select: { publicId: true } } },
  });
}

export async function deleteOverride(id: string) {
  return prisma.participantZoneOverride.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Résolution des droits d'un participant
// ---------------------------------------------------------------------------

/**
 * Tout ce dont la décision d'accès a besoin, en une requête.
 *
 * Le `select` est volontairement étroit : ni e-mail, ni téléphone, ni photo.
 * C'est cette même projection qui alimentera le manifeste hors ligne du
 * scanner (brief §2.11), et ce qui n'est pas lu ici ne peut pas s'y retrouver
 * par distraction.
 */
export async function findAccessSnapshot(editionId: string, publicId: string) {
  return prisma.participant.findFirst({
    where: { editionId, publicId },
    select: {
      publicId: true,
      status: true,
      category: {
        select: {
          alertOnScan: true,
          categoryZones: { select: { zone: { select: { code: true } } } },
        },
      },
      zoneOverrides: { select: { zone: { select: { code: true } } } },
      badges: {
        orderBy: { version: "desc" },
        take: 1,
        select: { revokedAt: true },
      },
    },
  });
}
