import { lireLangue, type Langue } from "@/lib/langue";
import { ENVOIS_PAR_MINUTE, momentEnvoi } from "@/lib/cadence-envoi";
import { estRefusQuota, type BoiteEnvoi } from "@/lib/mail";
import { jobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Actor } from "@/modules/participants/service";
import { bulkWhere, sendTemplatedEmail, type BulkFilter } from "./service";
import { BOITE_PAR_MODELE } from "./boites";

export interface NotificationJobPayload {
  editionId: string;
  templateKey: string;
  to: string;
  variables: Record<string, string>;
  participantId?: string;
  /**
   * Langue imposée. Sans elle, `sendTemplatedEmail` la déduit du participant —
   * ce qui ne marche pas pour un intervenant, qui n'en a pas et n'est pas
   * toujours rattaché à un participant.
   */
  locale?: Langue;
  /** Adresse de réponse (formulaire de contact). */
  replyTo?: string;
  /**
   * Boîte d'envoi (`lib/mail.ts`). Absente, c'est `transactionnel` : seuls les
   * points d'entrée qui envoient en nombre se déclarent `campagne`.
   */
  boite?: BoiteEnvoi;
  /**
   * Nombre de reports déjà subis pour cause de quota. Interne à la file —
   * aucun appelant ne le renseigne.
   */
  reports?: number;
}

/** Au-delà, on cesse de reporter : quatre reports de six heures couvrent la
 * fenêtre glissante de vingt-quatre heures d'un quota journalier Gmail. */
const REPORTS_MAX = 4;

/**
 * Délai avant nouvelle tentative, selon la nature du refus.
 *
 * Un quota journalier ne se libère qu'au fil de la fenêtre glissante : six
 * heures. Un bridage temporaire (`4.7.0`) retombe en quelques minutes.
 */
function delaiReport(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  const journalier = /\b5\.4\.5\b/.test(message) || /daily (user )?sending limit/i.test(message);
  return journalier ? 6 * 3600_000 : 15 * 60_000;
}

/**
 * Remet en file un envoi refusé faute de quota, plus tard.
 *
 * ## Pourquoi ne pas laisser la file réessayer
 *
 * Elle réessaie déjà — trois fois, à cinq puis dix secondes
 * (`lib/queue/bullmq-queue.ts`). Contre une panne passagère, c'est la bonne
 * réponse. Contre un quota journalier, les trois tentatives tombent en quinze
 * secondes, échouent toutes les trois, **consomment du quota à chaque fois**,
 * et le job meurt. Le 18 novembre 2026 : 764 lignes en échec pour environ
 * 250 messages réels, et rien pour les renvoyer.
 *
 * Reporter plutôt que s'acharner. Le job d'origine se termine normalement — il
 * n'a pas échoué, il a été déplacé — et un nouveau est posé à l'heure où la
 * boîte aura repris son souffle.
 *
 * Retourne `false` quand le quota ne se libère décidément pas : l'erreur
 * reprend alors son cours, le journal la consigne, et le bouton « Renvoyer les
 * échecs » de l'historique prend le relais.
 */
async function differer(payload: NotificationJobPayload, error: unknown): Promise<boolean> {
  const reports = (payload.reports ?? 0) + 1;
  if (reports > REPORTS_MAX) return false;

  await jobQueue.enqueue(
    "notification.send",
    { ...payload, reports },
    {
      idempotencyKey: `report-${reports}-${payload.templateKey}-${payload.participantId ?? payload.to}`,
      runAt: new Date(Date.now() + delaiReport(error)),
    },
  );
  return true;
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
    try {
      await sendTemplatedEmail(payload);
    } catch (error) {
      if (!estRefusQuota(error) || !(await differer(payload, error))) throw error;
    }
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
 * Mise en file **en tête** (23 novembre 2026) : pour ce qu'une personne attend
 * devant son écran — lien de connexion, code du BackOffice. Une campagne ou un
 * lot de badges en cours ne doit pas faire expirer un code avant son départ.
 */
export async function enqueueNotificationPrioritaire(
  payload: NotificationJobPayload,
  idempotencyKey?: string,
): Promise<void> {
  registerNotificationJobs();
  await jobQueue.enqueue("notification.send", payload, { idempotencyKey, prioritaire: true });
}

/**
 * Mise en file d'une série de notifications **en une écriture**.
 *
 * Avertir les inscrits d'un panel déplacé peut viser deux cents personnes : un
 * `enqueueNotification` par destinataire ferait deux cents allers-retours au
 * milieu de l'enregistrement du formulaire (même constat qu'au §22 pour les
 * invitations).
 */
export async function enqueueNotifications(
  entrees: { payload: NotificationJobPayload; idempotencyKey?: string; runAt?: Date }[],
): Promise<void> {
  if (entrees.length === 0) return;
  registerNotificationJobs();
  await jobQueue.enqueueMany(
    "notification.send",
    entrees.map((entree) => ({
      payload: entree.payload,
      options: { idempotencyKey: entree.idempotencyKey, runAt: entree.runAt },
    })),
  );
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
  /** Variables propres à la langue du destinataire (titre et chapô d'une newsletter…). */
  variablesParLangue?: Partial<Record<string, Record<string, string>>>;
  /**
   * Écarte les participants à qui ce modèle a **déjà** été envoyé avec succès.
   *
   * Sert à reprendre une campagne interrompue sans servir deux fois ceux
   * qu'elle avait atteints — le cas du 17 novembre 2026, où 80 des 273 rappels
   * J-7 étaient partis avant que la boîte d'envoi ne coupe. Hors reprise, on
   * laisse à faux : une relance délibérée vers les mêmes personnes reste
   * légitime, et ce n'est pas au code d'en décider.
   */
  exclureDejaRecu?: boolean;
  actor: Actor;
}): Promise<{ campaignId: string; queued: number; exclus: number }> {
  const campaignId = crypto.randomUUID();
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";

  const tous = await prisma.participant.findMany({
    where: bulkWhere(options.editionId, options.filter),
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      publicId: true,
      locale: true,
    },
  });

  let dejaServis = new Set<string>();
  if (options.exclureDejaRecu) {
    const lignes = await prisma.notificationLog.findMany({
      where: { templateKey: options.templateKey, status: "SENT", participantId: { not: null } },
      distinct: ["participantId"],
      select: { participantId: true },
    });
    dejaServis = new Set(lignes.map((ligne) => ligne.participantId!));
  }

  const recipients = tous.filter((candidat) => !dejaServis.has(candidat.id));

  /*
   * Les envois sont **étalés** (`lib/cadence-envoi.ts`), et mis en file en une
   * seule écriture.
   *
   * Sans cadence, 273 rappels sont partis d'un coup le 17 novembre 2026 :
   * Gmail en a accepté 80 puis a refusé les autres. La règle existait pour les
   * invitations depuis septembre ; elle n'avait jamais été reprise ici. Le
   * transport SMTP est mutualisé par ailleurs (`lib/mail.ts`) — c'étaient les
   * connexions que Google comptait, pas les messages, et les deux correctifs
   * vont ensemble.
   */
  const depart = new Date();
  await enqueueNotifications(
    recipients.map((recipient, index) => ({
      payload: {
        editionId: options.editionId,
        templateKey: options.templateKey,
        to: recipient.email,
        participantId: recipient.id,
        // La boîte du modèle (`boites.ts`), et non plus la campagne pour tout
        // ce qui part en nombre : un envoi groupé de badges doit sortir par le
        // compte des badges, dont le quota est dimensionné pour.
        //
        // Le repli reste la campagne — et non le défaut transactionnel de
        // `boitePourModele` : un modèle créé en base sans passer par le
        // catalogue, envoyé **en nombre**, a toutes les propriétés d'une
        // campagne et aucune de celles d'un code de connexion.
        boite: BOITE_PAR_MODELE[options.templateKey] ?? "campagne",
        variables: {
          prenom: recipient.firstName,
          nom: recipient.lastName,
          identifiant: recipient.publicId,
          lien_espace: `${baseUrl}/mon-espace`,
          lien_badge: `${baseUrl}/mon-espace`,
          ...options.variables,
          ...options.variablesParLangue?.[lireLangue(recipient.locale)],
        },
      },
      idempotencyKey: `bulk-${campaignId}-${recipient.id}`,
      runAt: momentEnvoi(index, depart),
    })),
  );

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
      exclus: tous.length - recipients.length,
      cadence: ENVOIS_PAR_MINUTE,
    },
  });

  return {
    campaignId,
    queued: recipients.length,
    exclus: tous.length - recipients.length,
  };
}
