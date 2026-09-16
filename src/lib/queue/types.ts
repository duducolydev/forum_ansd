export type JobHandler<T = unknown> = (payload: T) => Promise<void>;

export interface EnqueueOptions {
  /** Empêche la mise en file d'un doublon (envois d'email, génération de badge — brief §3.3). */
  idempotencyKey?: string;
  /** Planifie le job pour plus tard plutôt que dès que possible. */
  runAt?: Date;
}

export interface JobQueue {
  enqueue<T = unknown>(type: string, payload: T, options?: EnqueueOptions): Promise<void>;
  process<T = unknown>(type: string, handler: JobHandler<T>): void;
  /** Ferme les connexions ouvertes (Redis…) — à appeler en fin de script court-lived (ex. seed). */
  close(): Promise<void>;
}
