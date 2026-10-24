import { jobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";

export interface BadgeGenerateJobPayload {
  participantId: string;
  /** Rafraîchissement sans e-mail « badge prêt » (24 octobre 2026). */
  silencieux?: boolean;
}

let registered = false;

/**
 * Enregistrement paresseux, comme pour les invitations et les notifications
 * (cf. TODO T21). Le service est chargé **dynamiquement dans le handler** et
 * non importé en tête de fichier : `modules/badges/service` importe
 * `modules/participants/service` (pour `markBadged`), qui appelle lui-même
 * `registerBadgeJobs` — un import statique créerait un cycle à l'initialisation.
 */
export function registerBadgeJobs(): void {
  if (registered) return;
  registered = true;

  jobQueue.process<BadgeGenerateJobPayload>(
    "badge.generate",
    async ({ participantId, silencieux }) => {
      const { generateBadge } = await import("./service");
      await generateBadge(participantId, { type: "SYSTEM" }, { notifier: !silencieux });
    },
  );
}

/**
 * Refait le badge courant d'un participant **dans sa version** : même QR, rien
 * d'invalidé — seuls la couleur, le libellé et la mention de la catégorie
 * changent (24 octobre 2026). Sans badge déjà généré, il n'y a rien à refaire :
 * le premier rendu portera directement la bonne catégorie.
 *
 * - après un changement de catégorie du participant : avec l'e-mail « badge
 *   prêt », pour qu'il retélécharge un badge qui a changé d'allure ;
 * - après une retouche de la catégorie elle-même (couleur, mention) :
 *   `silencieux`, pour ne pas écrire à tous ses membres pour une nuance.
 *
 * La clé d'idempotence est horodatée : contrairement à la première
 * génération, deux changements successifs doivent produire deux rendus.
 */
export async function enqueueBadgeRefresh(
  participantId: string,
  options: { silencieux?: boolean } = {},
): Promise<boolean> {
  const badge = await prisma.badge.findFirst({
    where: { participantId, revokedAt: null, generatedAt: { not: null } },
    select: { id: true },
  });
  if (!badge) return false;

  registerBadgeJobs();
  await jobQueue.enqueue<BadgeGenerateJobPayload>(
    "badge.generate",
    { participantId, silencieux: options.silencieux ?? false },
    { idempotencyKey: `badge-refresh:${participantId}:${Date.now()}` },
  );
  return true;
}
