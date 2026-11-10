import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { HistoriqueSearch } from "./schema";

/**
 * Historique des e-mails envoyés (10 novembre 2026).
 *
 * Lecture seule de `NotificationLog`. Le journal ne conserve pas l'objet
 * rendu : l'objet affiché est celui du modèle, en français, tel qu'il est
 * aujourd'hui — suffisant pour reconnaître le message, sans prétendre à
 * l'exactitude d'une archive.
 */

export interface EnvoiHistorique {
  id: string;
  createdAt: Date;
  sentAt: Date | null;
  to: string;
  status: string;
  error: string | null;
  providerMessageId: string | null;
  /** Rebond signalé après coup par un avis de non-distribution. */
  bouncedAt: Date | null;
  templateKey: string;
  objet: string | null;
  /** Qui était visé : un participant, un invité pas encore inscrit, ou personne de connu. */
  destinataire:
    | { genre: "participant"; id: string; nom: string }
    | { genre: "invitation"; id: string; nom: string }
    | null;
}

/** Fin de journée incluse : `au=2026-11-23` doit contenir le 23 au soir (Dakar est en UTC). */
function bornes(search: HistoriqueSearch): { gte?: Date; lte?: Date } | undefined {
  const gte = search.du ? new Date(`${search.du}T00:00:00.000Z`) : undefined;
  const lte = search.au ? new Date(`${search.au}T23:59:59.999Z`) : undefined;
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

function filtres(search: HistoriqueSearch): Prisma.NotificationLogWhereInput {
  const periode = bornes(search);
  return {
    ...(search.statut ? { status: search.statut } : {}),
    ...(search.modele ? { templateKey: search.modele } : {}),
    ...(periode ? { createdAt: periode } : {}),
    ...(search.q
      ? {
          OR: [
            { to: { contains: search.q } },
            { participant: { firstName: { contains: search.q } } },
            { participant: { lastName: { contains: search.q } } },
            { participant: { publicId: { contains: search.q } } },
            { invitation: { firstName: { contains: search.q } } },
            { invitation: { lastName: { contains: search.q } } },
          ],
        }
      : {}),
  };
}

export async function listerEnvois(
  editionId: string,
  search: HistoriqueSearch,
): Promise<{ items: EnvoiHistorique[]; total: number }> {
  const where = filtres(search);

  const [lignes, total, modeles] = await Promise.all([
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (search.page - 1) * search.pageSize,
      take: search.pageSize,
      include: {
        participant: { select: { id: true, firstName: true, lastName: true } },
        invitation: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.notificationLog.count({ where }),
    prisma.notificationTemplate.findMany({
      where: { editionId, channel: "EMAIL" },
      select: { key: true, subjectFr: true },
    }),
  ]);

  const objets = new Map(modeles.map((modele) => [modele.key, modele.subjectFr]));

  return {
    items: lignes.map((ligne) => ({
      id: ligne.id,
      createdAt: ligne.createdAt,
      sentAt: ligne.sentAt,
      to: ligne.to,
      status: ligne.status,
      error: ligne.error,
      providerMessageId: ligne.providerMessageId,
      bouncedAt: ligne.bouncedAt,
      templateKey: ligne.templateKey,
      objet: objets.get(ligne.templateKey) ?? null,
      destinataire: ligne.participant
        ? {
            genre: "participant" as const,
            id: ligne.participant.id,
            nom: `${ligne.participant.firstName} ${ligne.participant.lastName}`.trim(),
          }
        : ligne.invitation
          ? {
              genre: "invitation" as const,
              id: ligne.invitation.id,
              nom: `${ligne.invitation.firstName} ${ligne.invitation.lastName}`.trim(),
            }
          : null,
    })),
    total,
  };
}

/** Modèles réellement présents dans le journal, pour le filtre. */
export async function modelesJournalises(): Promise<string[]> {
  const lignes = await prisma.notificationLog.groupBy({
    by: ["templateKey"],
    orderBy: { templateKey: "asc" },
  });
  return lignes.map((ligne) => ligne.templateKey);
}
