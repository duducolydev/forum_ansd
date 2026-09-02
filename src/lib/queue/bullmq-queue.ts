import { Queue, Worker, type Job as BullJob } from "bullmq";
import IORedis from "ioredis";
import type { EnqueueOptions, JobHandler, JobQueue } from "./types";

const QUEUE_NAME = "forum-ansd";

/** Implémentation par défaut (brief §3.1) : une file BullMQ/Redis unique, un
 * type de job par nom de job BullMQ, un seul worker qui dispatche vers les
 * handlers enregistrés via `process()`. */
export class BullMqJobQueue implements JobQueue {
  private readonly connection: IORedis;
  private readonly queue: Queue;
  private worker?: Worker;
  private readonly handlers = new Map<string, JobHandler>();

  constructor(redisUrl: string) {
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
  }

  async enqueue<T>(type: string, payload: T, options: EnqueueOptions = {}): Promise<void> {
    const delay = options.runAt ? Math.max(0, options.runAt.getTime() - Date.now()) : undefined;
    await this.queue.add(type, payload, {
      jobId: options.idempotencyKey,
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }

  process<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
    this.worker ??= new Worker(
      QUEUE_NAME,
      async (job: BullJob) => {
        const h = this.handlers.get(job.name);
        if (!h) {
          throw new Error(`Aucun handler enregistré pour le job "${job.name}"`);
        }
        await h(job.data);
      },
      { connection: this.connection },
    );
  }

  async close(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    this.connection.disconnect();
  }
}
