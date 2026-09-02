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

/** File d'attente unique de l'application (BullMQ si `REDIS_URL` est défini, sinon `DbJobQueue`). */
export const jobQueue = globalThis.__jobQueue ?? createJobQueue();

if (process.env.NODE_ENV !== "production") {
  globalThis.__jobQueue = jobQueue;
}
