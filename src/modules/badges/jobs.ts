import { jobQueue } from "@/lib/queue";

export interface BadgeGenerateJobPayload {
  participantId: string;
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

  jobQueue.process<BadgeGenerateJobPayload>("badge.generate", async ({ participantId }) => {
    const { generateBadge } = await import("./service");
    await generateBadge(participantId, { type: "SYSTEM" });
  });
}
