export type JobHandler<T = unknown> = (payload: T) => Promise<void>;

export interface EnqueueOptions {
  /** Empêche la mise en file d'un doublon (envois d'email, génération de badge — brief §3.3). */
  idempotencyKey?: string;
  /** Planifie le job pour plus tard plutôt que dès que possible. */
  runAt?: Date;
  /**
   * Place le job **en tête** de file plutôt qu'à la suite (23 novembre 2026).
   *
   * Réservé à ce qu'une personne attend devant son écran : code du
   * BackOffice, lien de connexion. Le jour du Forum, 2 728 tâches — surtout
   * des rendus de badges — attendaient devant les codes de connexion, traités
   * un à un : le code arrivait après son expiration, et personne n'entrait.
   */
  prioritaire?: boolean;
}

/** Un job d'une mise en file groupée : même type, charge et options propres. */
export interface EnqueueEntry<T = unknown> {
  payload: T;
  options?: EnqueueOptions;
}

export interface JobQueue {
  enqueue<T = unknown>(type: string, payload: T, options?: EnqueueOptions): Promise<void>;
  /**
   * Met en file plusieurs jobs du même type **en une opération**.
   *
   * Une campagne d'invitations en met un par destinataire : mille appels à
   * `enqueue` font mille écritures, et l'action dépasse le temps d'une requête
   * (mesuré : au-delà de 30 s pour ~1 000 invitations). Voir PLAN.md §22.
   */
  enqueueMany<T = unknown>(type: string, entrees: EnqueueEntry<T>[]): Promise<void>;
  process<T = unknown>(type: string, handler: JobHandler<T>): void;
  /**
   * Démarre la consommation, une fois **tous** les handlers enregistrés.
   *
   * Séparé de `process` depuis le 17 novembre 2026 : un worker consomme tous
   * les types de la file, et celui qui naissait au premier `process` rejetait
   * les jobs des types pas encore enregistrés (`queue/index.ts`). Idempotent,
   * et sans effet là où la file n'a pas de worker propre (`DbJobQueue`).
   */
  demarrerWorker(): void;
  /** Ferme les connexions ouvertes (Redis…) — à appeler en fin de script court-lived (ex. seed). */
  close(): Promise<void>;
}
