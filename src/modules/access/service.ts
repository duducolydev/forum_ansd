import { audit } from "@/lib/audit";
import * as repo from "./repository";
import { resoudreZones, type BadgeConnu } from "./decision";
import type { CheckpointInput, OverrideInput, ZoneInput } from "./schema";

export interface Actor {
  type: "USER" | "PARTICIPANT" | "SYSTEM";
  userId?: string;
}

/** Erreur métier destinée à être affichée telle quelle à l'utilisateur. */
export class AccessRuleError extends Error {}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

export async function listZones(editionId: string) {
  return repo.listZones(editionId);
}

export async function createZone(editionId: string, input: ZoneInput, actor: Actor) {
  const zone = await repo.createZone(editionId, {
    code: input.code,
    name: input.name,
    description: input.description || null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "zone.create",
    entity: "Zone",
    entityId: zone.id,
    after: { code: zone.code, name: zone.name },
  });

  return zone;
}

export async function updateZone(id: string, input: ZoneInput, actor: Actor) {
  const before = await repo.findZone(id);
  if (!before) throw new AccessRuleError("Zone introuvable.");

  const zone = await repo.updateZone(id, {
    code: input.code,
    name: input.name,
    description: input.description || null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "zone.update",
    entity: "Zone",
    entityId: id,
    before: { code: before.code, name: before.name },
    after: { code: zone.code, name: zone.name },
  });

  return zone;
}

/**
 * Suppression d'une zone.
 *
 * Refusée tant qu'un point de contrôle y est rattaché : la contrainte de clé
 * étrangère l'interdirait de toute façon, mais avec un message illisible. Les
 * lignes de matrice et les exceptions, elles, disparaissent en cascade — d'où
 * l'avertissement chiffré présenté dans l'écran d'administration.
 */
export async function deleteZone(id: string, actor: Actor) {
  const zone = await repo.findZoneWithCounts(id);
  if (!zone) throw new AccessRuleError("Zone introuvable.");

  if (zone._count.checkpoints > 0) {
    throw new AccessRuleError(
      `Cette zone porte ${zone._count.checkpoints} point(s) de contrôle. Déplacez-les ou supprimez-les d'abord.`,
    );
  }

  await repo.deleteZone(id);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "zone.delete",
    entity: "Zone",
    entityId: id,
    before: {
      code: zone.code,
      name: zone.name,
      categoriesLiees: zone._count.categoryZones,
      exceptionsLiees: zone._count.overrides,
    },
  });
}

// ---------------------------------------------------------------------------
// Points de contrôle
// ---------------------------------------------------------------------------

export async function listCheckpoints(editionId: string) {
  return repo.listCheckpoints(editionId);
}

export async function createCheckpoint(editionId: string, input: CheckpointInput, actor: Actor) {
  const checkpoint = await repo.createCheckpoint(editionId, {
    name: input.name,
    zoneId: input.zoneId,
    deviceLabel: input.deviceLabel || null,
    isActive: input.isActive,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "checkpoint.create",
    entity: "Checkpoint",
    entityId: checkpoint.id,
    after: { name: checkpoint.name, zoneId: checkpoint.zoneId },
  });

  return checkpoint;
}

export async function updateCheckpoint(id: string, input: CheckpointInput, actor: Actor) {
  const checkpoint = await repo.updateCheckpoint(id, {
    name: input.name,
    zoneId: input.zoneId,
    deviceLabel: input.deviceLabel || null,
    isActive: input.isActive,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "checkpoint.update",
    entity: "Checkpoint",
    entityId: id,
    after: { name: checkpoint.name, zoneId: checkpoint.zoneId, isActive: checkpoint.isActive },
  });

  return checkpoint;
}

/**
 * Un point de contrôle qui a déjà servi n'est pas supprimé mais désactivé : ses
 * scans sont des faits de présence, et les effacer effacerait la traçabilité du
 * jour J.
 */
export async function deleteCheckpoint(id: string, actor: Actor) {
  const scans = await repo.countScans(id);
  if (scans > 0) {
    throw new AccessRuleError(
      `Ce point a enregistré ${scans} scan(s) : désactivez-le au lieu de le supprimer, pour conserver l'historique des présences.`,
    );
  }

  await repo.deleteCheckpoint(id);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "checkpoint.delete",
    entity: "Checkpoint",
    entityId: id,
  });
}

// ---------------------------------------------------------------------------
// Matrice catégorie × zone
// ---------------------------------------------------------------------------

export interface AccessMatrix {
  categories: { id: string; code: string; labelFr: string; alertOnScan: boolean }[];
  zones: { id: string; code: string; name: string }[];
  /** Clés `categoryId:zoneId` autorisées. */
  allowed: Set<string>;
}

export function matrixKey(categoryId: string, zoneId: string): string {
  return `${categoryId}:${zoneId}`;
}

export async function getAccessMatrix(editionId: string): Promise<AccessMatrix> {
  const [categories, zones, pairs] = await Promise.all([
    repo.listCategories(editionId),
    repo.listZones(editionId),
    repo.listMatrixPairs(editionId),
  ]);

  return {
    categories,
    zones: zones.map((zone) => ({ id: zone.id, code: zone.code, name: zone.name })),
    allowed: new Set(pairs.map((pair) => matrixKey(pair.categoryId, pair.zoneId))),
  };
}

/**
 * Enregistre la matrice entière depuis l'écran d'administration.
 *
 * La boucle est pilotée par les catégories et zones **lues en base**, jamais par
 * les clés reçues du formulaire : une clé fabriquée à la main dans la requête ne
 * peut donc pas ouvrir une paire qui n'existe pas dans cette édition. Le
 * formulaire ne fait que répondre « oui » ou « non » à des cases que le serveur
 * a lui-même posées.
 *
 * Seules les cases qui changent sont écrites, et l'audit reçoit une entrée par
 * enregistrement plutôt qu'une par case : soixante-dix lignes de journal pour
 * une case décochée rendraient le journal illisible le jour où il faudra
 * comprendre qui a ouvert l'espace VIP.
 */
export async function saveAccessMatrix(
  editionId: string,
  clesAutorisees: readonly string[],
  categoriesEnAlerte: readonly string[],
  actor: Actor,
): Promise<{ ajouts: string[]; retraits: string[]; alertes: string[] }> {
  const matrice = await getAccessMatrix(editionId);
  const voulu = new Set(clesAutorisees);
  const alerte = new Set(categoriesEnAlerte);

  const ajouts: string[] = [];
  const retraits: string[] = [];
  const alertes: string[] = [];

  for (const categorie of matrice.categories) {
    if (alerte.has(categorie.id) !== categorie.alertOnScan) {
      await repo.setCategoryAlert(categorie.id, alerte.has(categorie.id));
      alertes.push(`${categorie.code} : ${alerte.has(categorie.id) ? "oui" : "non"}`);
    }

    for (const zone of matrice.zones) {
      const cle = matrixKey(categorie.id, zone.id);
      const avant = matrice.allowed.has(cle);
      const apres = voulu.has(cle);
      if (avant === apres) continue;

      if (apres) {
        await repo.allowCell(categorie.id, zone.id);
        ajouts.push(`${categorie.code} × ${zone.code}`);
      } else {
        await repo.denyCell(categorie.id, zone.id);
        retraits.push(`${categorie.code} × ${zone.code}`);
      }
    }
  }

  if (ajouts.length > 0 || retraits.length > 0 || alertes.length > 0) {
    await audit.log({
      actorType: actor.type,
      actorUserId: actor.userId,
      action: "access_matrix.update",
      entity: "Edition",
      entityId: editionId,
      after: { ajouts, retraits, alertes },
    });
  }

  return { ajouts, retraits, alertes };
}

// ---------------------------------------------------------------------------
// Exceptions individuelles
// ---------------------------------------------------------------------------

export async function listOverrides(editionId: string) {
  return repo.listOverrides(editionId);
}

export async function grantOverride(editionId: string, input: OverrideInput, actor: Actor) {
  const participant = await repo.findParticipantByPublicId(
    editionId,
    input.participantPublicId.toUpperCase(),
  );
  if (!participant) {
    throw new AccessRuleError(`Aucun participant avec l'identifiant ${input.participantPublicId}.`);
  }

  const override = await repo
    .createOverride({
      participantId: participant.id,
      zoneId: input.zoneId,
      grantedById: actor.userId,
      reason: input.reason,
    })
    .catch((error: unknown) => {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new AccessRuleError("Ce participant a déjà une exception sur cette zone.");
      }
      throw error;
    });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "zone_override.grant",
    entity: "ParticipantZoneOverride",
    entityId: override.id,
    after: { participantId: participant.id, zoneId: input.zoneId, reason: input.reason },
  });

  return override;
}

export async function revokeOverride(id: string, actor: Actor) {
  const before = await repo.findOverride(id);
  if (!before) throw new AccessRuleError("Exception introuvable.");

  await repo.deleteOverride(id);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "zone_override.revoke",
    entity: "ParticipantZoneOverride",
    entityId: id,
    before: {
      participant: before.participant.publicId,
      zone: before.zone.code,
      reason: before.reason,
    },
  });
}

// ---------------------------------------------------------------------------
// Résolution des droits
// ---------------------------------------------------------------------------

/**
 * Traduit l'état en base vers la forme exacte que consomme `evaluerAcces`.
 *
 * C'est le seul point de contact entre la base et la décision : le scanner hors
 * ligne construira le même objet depuis son manifeste, puis les deux chemins
 * appelleront le même code. C'est ce qui garantit qu'une règle modifiée ici
 * s'applique des deux côtés.
 */
export async function getAccessSnapshot(
  editionId: string,
  publicId: string,
): Promise<BadgeConnu | null> {
  const participant = await repo.findAccessSnapshot(editionId, publicId);
  if (!participant) return null;

  return {
    publicId: participant.publicId,
    statut: participant.status,
    zones: resoudreZones(
      participant.category.categoryZones.map((lien) => lien.zone.code),
      participant.zoneOverrides.map((exception) => exception.zone.code),
    ),
    alerteAccueil: participant.category.alertOnScan,
    revoque: participant.badges[0]?.revokedAt != null,
  };
}
