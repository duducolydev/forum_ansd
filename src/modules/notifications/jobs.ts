import { jobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Actor } from "@/modules/participants/service";
import { bulkWhere, sendTemplatedEmail, type BulkFilter } from "./service";

export interface NotificationJobPayload {
  editionId: string;
  templateKey: string;
  to: string;
  variables: Record<string, string>;
  participantId?: string;
}

let registered = false;

/**
 * Enregistrement paresseux (même raison que pour les invitations : éviter
 * d'ouvrir un worker BullMQ à l'import du module, et garder BullMQ hors du
 * bundle Edge du middleware).
 */
export function registerNotificationJobs(): void {
  if (registered) return;
  registered = true;

  jobQueue.process<NotificationJobPayload>("notification.send", async (payload) => {
    await sendTemplatedEmail(payload);
  });
}

/**
 * Mise en file d'une notification — jamais d'envoi synchrone (brief §3.3).
 *
 * `runAt` permet de programmer un envoi à l'avance (rappels J-7 et J-1) : sans
 * lui, un rappel « dans sept jours » partait à la seconde où on le planifiait.
 */
export async function enqueueNotification(
  payload: NotificationJobPayload,
  idempotencyKey?: string,
  runAt?: Date,
): Promise<void> {
  registerNotificationJobs();
  await jobQueue.enqueue("notification.send", payload, { idempotencyKey, runAt });
}

/**
 * Envoi groupé (brief §5.13). Un job **par destinataire** plutôt qu'un job
 * unique qui boucle : un échec isolé (adresse invalide) n'interrompt pas la
 * campagne, chaque envoi est réessayé indépendamment, et `NotificationLog`
 * garde une ligne par participant.
 *
 * La clé d'idempotence porte l'identifiant de campagne : relancer le même envoi
 * groupé deux fois d'affilée ne double pas les messages, alors qu'une nouvelle
 * campagne vers les mêmes personnes reste possible.
 */
export async function enqueueBulk(options: {
  editionId: string;
  templateKey: string;
  filter: BulkFilter;
  variables?: Record<string, string>;
  actor: Actor;
}): Promise<{ campaignId: string; queued: number }> {
  const campaignId = crypto.randomUUID();
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

  const recipients = await prisma.participant.findMany({
    where: bulkWhere(options.editionId, options.filter),
    select: { id: true, email: true, firstName: true, lastName: true, publicId: true },
  });

  for (const recipient of recipients) {
    await enqueueNotification(
      {
        editionId: options.editionId,
        templateKey: options.templateKey,
        to: recipient.email,
        participantId: recipient.id,
        variables: {
          prenom: recipient.firstName,
          nom: recipient.lastName,
          identifiant: recipient.publicId,
          lien_espace: `${baseUrl}/mon-espace`,
          lien_badge: `${baseUrl}/mon-espace`,
          ...options.variables,
        },
      },
      `bulk-${campaignId}-${recipient.id}`,
    );
  }

  await audit.log({
    actorType: options.actor.type,
    actorUserId: options.actor.userId,
    action: "notification.bulk_sent",
    entity: "Edition",
    entityId: options.editionId,
    after: {
      campaignId,
      templateKey: options.templateKey,
      filter: options.filter,
      recipients: recipients.length,
    },
  });

  return { campaignId, queued: recipients.length };
}
