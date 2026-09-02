import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { EnqueueOptions, JobHandler, JobQueue } from "./types";

const MAX_ATTEMPTS = 3;

/** Repli sans Redis (brief §3.1) : table `Job` + exécution pilotée par un cron
 * externe qui appelle `runPendingJobs()` périodiquement (cf. docker/, tâche 0.8). */
export class DbJobQueue implements JobQueue {
  private readonly handlers = new Map<string, JobHandler>();

  async enqueue<T>(type: string, payload: T, options: EnqueueOptions = {}): Promise<void> {
    if (options.idempotencyKey) {
      const existing = await prisma.job.findUnique({
        where: { idempotencyKey: options.idempotencyKey },
      });
      if (existing) return;
    }
    await prisma.job.create({
      data: {
        type,
        payload: payload as Prisma.InputJsonValue,
        runAt: options.runAt ?? new Date(),
        idempotencyKey: options.idempotencyKey,
      },
    });
  }

  process<T>(type: string, handler: JobHandler<T>): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /** À appeler périodiquement (cron) pour exécuter les jobs en attente. */
  async runPendingJobs(limit = 20): Promise<void> {
    const jobs = await prisma.job.findMany({
      where: { status: "PENDING", runAt: { lte: new Date() } },
      orderBy: { runAt: "asc" },
      take: limit,
    });

    for (const job of jobs) {
      await prisma.job.update({ where: { id: job.id }, data: { status: "RUNNING" } });
      try {
        const handler = this.handlers.get(job.type);
        if (!handler) {
          throw new Error(`Aucun handler enregistré pour le job "${job.type}"`);
        }
        await handler(job.payload);
        await prisma.job.update({ where: { id: job.id }, data: { status: "DONE" } });
      } catch (error) {
        const attempts = job.attempts + 1;
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
            attempts,
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }
}
