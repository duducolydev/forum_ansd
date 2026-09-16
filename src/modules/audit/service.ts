import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AuditSearch } from "./schema";

/**
 * Consultation du journal d'audit (brief §5.14).
 *
 * Lecture seule, sans exception : la table est append-only (0.4) et rien ici
 * n'expose d'écriture. Un journal que l'on peut corriger ne prouve plus rien.
 */

export interface EntreeAudit {
  id: string;
  createdAt: Date;
  actorType: string;
  action: string;
  entity: string;
  entityId: string;
  ip: string | null;
  userAgent: string | null;
  before: unknown;
  after: unknown;
  acteur: string;
}

/** Fin de journée incluse : `au=2026-11-23` doit contenir le 23 au soir. */
function bornes(search: AuditSearch): { gte?: Date; lte?: Date } | undefined {
  const gte = search.du ? new Date(`${search.du}T00:00:00.000Z`) : undefined;
  const lte = search.au ? new Date(`${search.au}T23:59:59.999Z`) : undefined;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

function filtres(search: AuditSearch): Prisma.AuditLogWhereInput {
  const periode = bornes(search);
  return {
    ...(search.action ? { action: search.action } : {}),
    ...(search.entity ? { entity: search.entity } : {}),
    ...(search.actorUserId ? { actorUserId: search.actorUserId } : {}),
    ...(periode ? { createdAt: periode } : {}),
    ...(search.q
      ? {
          // La recherche porte sur l'identifiant de l'objet et sur le nom de
          // l'auteur : ce sont les deux entrées d'une vérification réelle
          // (« qu'est-il arrivé à ce badge », « qu'a fait cette personne »).
          OR: [
            { entityId: { contains: search.q } },
            { action: { contains: search.q } },
            { actorUser: { name: { contains: search.q } } },
            { actorUser: { email: { contains: search.q } } },
          ],
        }
      : {}),
  };
}

export async function listerEntrees(
  search: AuditSearch,
): Promise<{ items: EntreeAudit[]; total: number }> {
  const where = filtres(search);

  const [lignes, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (search.page - 1) * search.pageSize,
      take: search.pageSize,
      include: {
        actorUser: { select: { name: true, email: true } },
        actorParticipant: { select: { firstName: true, lastName: true, publicId: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    items: lignes.map((ligne) => ({
      id: ligne.id,
      createdAt: ligne.createdAt,
      actorType: ligne.actorType,
      action: ligne.action,
      entity: ligne.entity,
      entityId: ligne.entityId,
      ip: ligne.ip,
      userAgent: ligne.userAgent,
      before: ligne.before,
      after: ligne.after,
      acteur: nommerActeur(ligne),
    })),
    total,
  };
}

function nommerActeur(ligne: {
  actorType: string;
  actorUser: { name: string; email: string } | null;
  actorParticipant: { firstName: string; lastName: string; publicId: string } | null;
}): string {
  if (ligne.actorUser) return `${ligne.actorUser.name} (${ligne.actorUser.email})`;
  if (ligne.actorParticipant) {
    const participant = ligne.actorParticipant;
    return `${participant.firstName} ${participant.lastName} (${participant.publicId})`;
  }
  // Un job de file, un cron, ou une action déclenchée hors session.
  return ligne.actorType === "SYSTEM" ? "Système" : ligne.actorType;
}

/**
 * Valeurs proposées dans les filtres.
 *
 * Tirées du contenu réel de la table plutôt que d'une liste écrite à la main :
 * chaque module ajoute ses propres actions au fil du temps, et une liste figée
 * aurait cessé d'être complète dès le module suivant.
 */
export async function valeursDeFiltre(): Promise<{
  actions: string[];
  entites: string[];
  acteurs: { id: string; nom: string }[];
}> {
  // `groupBy` et non `distinct` : Prisma dédoublonne `distinct` en mémoire
  // après avoir rapatrié les lignes, ce qui coûterait la table entière — et
  // celle-ci ne cesse de grossir. `groupBy` descend en SQL.
  const [actions, entites, acteurs] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
    prisma.user.findMany({
      where: { auditLogs: { some: {} } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    actions: actions.map((ligne) => ligne.action),
    entites: entites.map((ligne) => ligne.entity),
    acteurs: acteurs.map((acteur) => ({ id: acteur.id, nom: `${acteur.name} (${acteur.email})` })),
  };
}

/** Plafond de l'export : au-delà, on affine les filtres plutôt que de tout tirer. */
export const EXPORT_MAX_LIGNES = 20_000;

export async function entreesPourExport(search: AuditSearch): Promise<EntreeAudit[]> {
  const { items } = await listerEntrees({ ...search, page: 1, pageSize: EXPORT_MAX_LIGNES });
  return items;
}

/** Aplatit une entrée pour le tableur : le JSON avant/après tient en deux colonnes. */
export function ligneCsv(entree: EntreeAudit): string[] {
  return [
    entree.createdAt.toISOString(),
    entree.action,
    entree.entity,
    entree.entityId,
    entree.acteur,
    entree.actorType,
    entree.ip ?? "",
    entree.before === null || entree.before === undefined ? "" : JSON.stringify(entree.before),
    entree.after === null || entree.after === undefined ? "" : JSON.stringify(entree.after),
  ];
}

export const COLONNES_CSV = [
  "Horodatage (UTC)",
  "Action",
  "Objet",
  "Identifiant",
  "Auteur",
  "Type d'auteur",
  "Adresse IP",
  "Avant",
  "Après",
];
