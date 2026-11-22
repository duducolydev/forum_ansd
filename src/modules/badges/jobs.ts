import { jobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { GABARIT_BADGE } from "./format";

export interface BadgeGenerateJobPayload {
  participantId: string;
  /** Rafraîchissement sans e-mail « badge prêt » (24 octobre 2026). */
  silencieux?: boolean;
}

/** Rendu d'une carte anonyme : elle n'a pas de porteur, donc pas de participant. */
export interface BadgeAnonymeJobPayload {
  badgeId: string;
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

  jobQueue.process<BadgeAnonymeJobPayload>("badge.generate_anonymous", async ({ badgeId }) => {
    const { genererBadgeAnonyme } = await import("./service");
    await genererBadgeAnonyme(badgeId);
  });
}

/**
 * Met en file le rendu d'un lot de cartes anonymes, en un seul aller-retour.
 *
 * Clé fixe par badge : relancer la création ne doit pas empiler deux rendus de
 * la même carte.
 */
export async function enqueueBadgesAnonymes(badgeIds: string[]): Promise<void> {
  if (badgeIds.length === 0) return;

  registerBadgeJobs();
  await jobQueue.enqueueMany<BadgeAnonymeJobPayload>(
    "badge.generate_anonymous",
    badgeIds.map((badgeId) => ({
      payload: { badgeId },
      options: { idempotencyKey: `badge-anonyme:${badgeId}` },
    })),
  );
}

/**
 * Remet en file le rendu de cartes anonymes déjà rendues, au gabarit en
 * vigueur. La clé d'idempotence porte le gabarit : celle de la création
 * (`badge-anonyme:<id>`) existe déjà et ferait ignorer la demande.
 */
export async function enqueueRefaireAnonymes(badgeIds: string[]): Promise<void> {
  if (badgeIds.length === 0) return;
  registerBadgeJobs();
  await jobQueue.enqueueMany<BadgeAnonymeJobPayload>(
    "badge.generate_anonymous",
    badgeIds.map((badgeId) => ({
      payload: { badgeId },
      options: { idempotencyKey: `badge-anonyme:${badgeId}:${GABARIT_BADGE}` },
    })),
  );
}

/** Les textes imprimés sur le badge, en plus de la catégorie et de la photo. */
type TextesDuBadge = {
  civility?: string | null;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  organization: string | null;
};

/**
 * Vrai si une modification change ce qui s'imprime sur le badge (29 octobre
 * 2026) : une correction de nom ou d'organisation faite après la génération
 * restait sinon invisible sur le badge déjà rendu.
 */
export function textesDuBadgeModifies(avant: TextesDuBadge, apres: TextesDuBadge): boolean {
  return (
    (avant.civility ?? "") !== (apres.civility ?? "") ||
    avant.firstName !== apres.firstName ||
    avant.lastName !== apres.lastName ||
    (avant.jobTitle ?? "") !== (apres.jobTitle ?? "") ||
    (avant.organization ?? "") !== (apres.organization ?? "")
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
/**
 * Même chose pour tout un lot, **en un seul aller-retour** (19 novembre 2026).
 *
 * `enqueueBadgeRefresh` appelé en boucle faisait deux allers-retours par
 * participant — une lecture pour retrouver le badge, une écriture Redis — soit
 * six cents pour trois cents badges, dans le temps d'une requête HTTP. La
 * mesure inscrite au contrat de `JobQueue` est sans appel : au-delà de trente
 * secondes pour un millier de mises en file une par une.
 *
 * La lecture n'est pas reprise ici : l'appelant (`lot.ts`) vient d'interroger
 * la base pour établir son périmètre et sait déjà quels badges sont valides et
 * rendus. La refaire, c'est poser deux fois la même question à une seconde
 * d'intervalle.
 *
 * L'horodatage de la clé est commun au lot : il distingue ce lot des rendus
 * précédents, et la clé reste unique par participant à l'intérieur.
 */
export async function enqueueBadgeRefreshMany(
  participantIds: string[],
  options: { silencieux?: boolean } = {},
): Promise<void> {
  if (participantIds.length === 0) return;

  registerBadgeJobs();
  const lot = Date.now();
  await jobQueue.enqueueMany<BadgeGenerateJobPayload>(
    "badge.generate",
    participantIds.map((participantId) => ({
      payload: { participantId, silencieux: options.silencieux ?? false },
      options: { idempotencyKey: `badge-refresh:${participantId}:${lot}` },
    })),
  );
}

/**
 * Première génération pour tout un lot, en un seul aller-retour.
 *
 * Clé fixe par participant, comme `enqueueBadgeGeneration` dont c'est la forme
 * groupée : deux transitions successives ne doivent pas empiler deux rendus
 * identiques.
 */
export async function enqueueBadgeGenerationMany(participantIds: string[]): Promise<void> {
  if (participantIds.length === 0) return;

  registerBadgeJobs();
  await jobQueue.enqueueMany<BadgeGenerateJobPayload>(
    "badge.generate",
    participantIds.map((participantId) => ({
      payload: { participantId },
      options: { idempotencyKey: `badge-generate:${participantId}` },
    })),
  );
}

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

/**
 * Met en file le rendu d'une version **qui vient d'être créée** par une
 * réémission (`prepareReissue`), avec l'e-mail « badge prêt » : le QR a changé,
 * la personne doit retélécharger son badge.
 *
 * Clé d'idempotence portant la version : celle de la première génération est
 * fixe par participant, et une réémission ne doit pas se faire écarter comme
 * un doublon du rendu initial.
 */
export async function enqueueBadgeReissueRender(
  participantId: string,
  version: number,
): Promise<void> {
  registerBadgeJobs();
  await jobQueue.enqueue<BadgeGenerateJobPayload>(
    "badge.generate",
    { participantId },
    { idempotencyKey: `badge-reissue:${participantId}:v${version}` },
  );
}
