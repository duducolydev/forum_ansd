import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { enqueueNotification } from "./jobs";

/**
 * Rappels planifiés avant le Forum (brief §14, Lot 2).
 *
 * Distincts des relances d'invitation (module 3.3), qui poursuivent ceux qui ne
 * se sont **pas** inscrits : ces rappels-ci s'adressent aux confirmés, pour leur
 * redonner la date, le lieu et le lien vers leur badge.
 *
 * Les envois sont **programmés à l'avance** (`runAt`) plutôt que déclenchés par
 * une tâche planifiée quotidienne : la file sait déjà différer un job, et un
 * cron de plus serait une pièce mobile supplémentaire à surveiller le jour J.
 */

export interface Echeance {
  cle: "reminder_j7" | "reminder_j1";
  libelle: string;
  joursAvant: number;
}

export const ECHEANCES: Echeance[] = [
  { cle: "reminder_j7", libelle: "Une semaine avant", joursAvant: 7 },
  { cle: "reminder_j1", libelle: "La veille", joursAvant: 1 },
];

export interface PlanRappel {
  cle: string;
  libelle: string;
  envoiLe: Date;
  destinataires: number;
  /** Déjà passé : rien ne sera programmé, et l'écran doit le dire. */
  depasse: boolean;
  dejaProgrammes: number;
}

/** 9 h, heure de Dakar (UTC) : un rappel reçu à 3 h du matin ne sert personne. */
const HEURE_ENVOI = 9;

export function dateEnvoi(debutEdition: Date, joursAvant: number): Date {
  const envoi = new Date(debutEdition);
  envoi.setUTCDate(envoi.getUTCDate() - joursAvant);
  envoi.setUTCHours(HEURE_ENVOI, 0, 0, 0);
  return envoi;
}

/**
 * Clé d'idempotence d'un rappel.
 *
 * Elle porte l'échéance **et** le participant : reprogrammer les rappels après
 * avoir confirmé vingt personnes de plus n'enverra pas un second message aux
 * précédentes. C'est ce qui permet de presser le bouton sans hésiter.
 */
function cleIdempotence(editionId: string, cle: string, participantId: string): string {
  return `${cle}:${editionId}:${participantId}`;
}

async function destinataires(editionId: string) {
  return prisma.participant.findMany({
    where: {
      editionId,
      deletedAt: null,
      // Ceux qui viennent. Un rappel à quelqu'un qui a décliné serait au mieux
      // inutile, au pire blessant.
      status: { in: ["CONFIRMED", "BADGED"] },
    },
    select: { id: true, email: true, firstName: true, locale: true },
  });
}

export async function apercu(editionId: string, debutEdition: Date): Promise<PlanRappel[]> {
  const attendus = await destinataires(editionId);
  const maintenant = Date.now();

  return Promise.all(
    ECHEANCES.map(async (echeance) => {
      const envoiLe = dateEnvoi(debutEdition, echeance.joursAvant);
      const dejaProgrammes = await prisma.notificationLog.count({
        where: { templateKey: echeance.cle, participant: { editionId } },
      });

      return {
        cle: echeance.cle,
        libelle: echeance.libelle,
        envoiLe,
        destinataires: attendus.length,
        depasse: envoiLe.getTime() < maintenant,
        dejaProgrammes,
      };
    }),
  );
}

export interface ResultatPlanification {
  programmes: number;
  ignores: number;
  echeancesDepassees: string[];
}

/**
 * Programme les rappels pour toutes les échéances encore à venir.
 *
 * Une échéance dépassée est **sautée et signalée**, pas envoyée immédiatement :
 * recevoir « le Forum commence dans sept jours » la veille de l'ouverture
 * décrédibiliserait tout le dispositif.
 */
export async function planifier(
  editionId: string,
  debutEdition: Date,
  actorUserId: string | undefined,
): Promise<ResultatPlanification> {
  const attendus = await destinataires(editionId);
  const maintenant = Date.now();

  let programmes = 0;
  let ignores = 0;
  const echeancesDepassees: string[] = [];

  for (const echeance of ECHEANCES) {
    const envoiLe = dateEnvoi(debutEdition, echeance.joursAvant);
    if (envoiLe.getTime() < maintenant) {
      echeancesDepassees.push(echeance.libelle);
      continue;
    }

    /*
     * Ceux qui ont déjà reçu ce rappel sont écartés.
     *
     * La clé d'idempotence de la file ne suffit pas : BullMQ efface un job
     * terminé, si bien qu'une seconde planification après l'envoi recréerait le
     * même message. `NotificationLog` garde la trace, elle.
     */
    const dejaRecu = new Set(
      (
        await prisma.notificationLog.findMany({
          where: { templateKey: echeance.cle, participant: { editionId } },
          select: { participantId: true },
        })
      ).map((ligne) => ligne.participantId),
    );

    for (const participant of attendus) {
      if (dejaRecu.has(participant.id)) {
        ignores++;
        continue;
      }
      await enqueueNotification(
        {
          editionId,
          templateKey: echeance.cle,
          to: participant.email,
          participantId: participant.id,
          variables: { prenom: participant.firstName },
        },
        cleIdempotence(editionId, echeance.cle, participant.id),
        envoiLe,
      );
      programmes++;
    }
  }

  await audit.log({
    actorType: "USER",
    actorUserId,
    action: "reminders.scheduled",
    entity: "Edition",
    entityId: editionId,
    after: { programmes, ignores, echeancesDepassees, destinataires: attendus.length },
  });

  return { programmes, ignores, echeancesDepassees };
}
