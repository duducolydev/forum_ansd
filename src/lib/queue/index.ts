import { BullMqJobQueue } from "./bullmq-queue";
import { DbJobQueue } from "./db-queue";
import type { JobQueue } from "./types";

export type { EnqueueOptions, JobHandler, JobQueue } from "./types";

declare global {
  var __jobQueue: JobQueue | undefined;
}

function createJobQueue(): JobQueue {
  return process.env.REDIS_URL ? new BullMqJobQueue(process.env.REDIS_URL) : new DbJobQueue();
}

/**
 * File d'attente unique de l'application (BullMQ si `REDIS_URL` est défini,
 * sinon `DbJobQueue`).
 *
 * ## Pourquoi `globalThis` **aussi** en production (17 novembre 2026)
 *
 * Le garde était conditionné à `NODE_ENV !== "production"`, comme pour le
 * client Prisma de `lib/db.ts` — là-bas pour survivre au rechargement à chaud
 * du développement. Ici, la conséquence en production est d'une autre nature.
 *
 * Next découpe le serveur en plusieurs paquets, chacun avec son propre registre
 * de modules : ce fichier est donc évalué **plusieurs fois dans le même
 * processus**. Sans le garde, chaque copie fabriquait sa propre file, sa propre
 * table de handlers — et son propre `Worker`, branché sur la même file Redis.
 *
 * Un worker consomme **tous** les types de jobs de la file, pas seulement ceux
 * que son paquet a enregistrés. La copie issue d'un paquet qui n'importe que
 * les badges créait donc un worker qui happait les `notification.send` et les
 * rejetait aussitôt : « Aucun handler enregistré ». Les envois tombaient sur le
 * bon worker ou sur le mauvais, au hasard.
 *
 * Constaté le 17 novembre 2026 : sur deux campagnes de 273 rappels J-7,
 * 39 messages partis, 507 jobs en échec, et pas une ligne dans le journal des
 * notifications — l'erreur survenant avant son écriture, rien ne la signalait
 * dans le BackOffice.
 *
 * Le garde est donc inconditionnel : **une file, une table de handlers, un
 * worker**, quel que soit le nombre de paquets qui importent ce module.
 */
export const jobQueue: JobQueue = (globalThis.__jobQueue ??= createJobQueue());
