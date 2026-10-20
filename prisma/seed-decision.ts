/**
 * Ce que le seed a le droit de faire, selon la base et l'environnement
 * (19 octobre 2026). Isolé de `seed.ts`, qui s'exécute dès son import, pour
 * être testé sans base.
 */
export interface ContexteSeed {
  /** Une édition existe déjà : la base est en service, ou l'a été. */
  baseInitialisee: boolean;
  /** `SEED_DEMO=1` ou `pnpm db:seed --demo`. */
  demoDemandee: boolean;
  production: boolean;
}

export type DecisionSeed =
  | { action: "refus"; message: string }
  | { action: "rien"; message: string }
  | { action: "initialiser"; demo: boolean };

export function decisionSeed({
  baseInitialisee,
  demoDemandee,
  production,
}: ContexteSeed): DecisionSeed {
  // Refusé avant tout le reste, même sur une base déjà initialisée : c'est
  // une erreur de manipulation à signaler, pas une commande sans effet.
  if (demoDemandee && production) {
    return {
      action: "refus",
      message:
        "Données de démonstration refusées en production : elles se mêleraient aux vraies " +
        "inscriptions, et leurs e-mails partiraient. Rien n'a été écrit.",
    };
  }

  if (baseInitialisee) {
    return {
      action: "rien",
      message:
        "Base déjà initialisée : le seed ne s'exécute que sur une base vide, et n'a rien écrit. " +
        "Une donnée à ajouter sur une base en service passe par une migration " +
        "(prisma/garde-migrations.ts)." +
        (production ? "" : " En local, « pnpm prisma migrate reset » repart d'une base vide."),
    };
  }

  return { action: "initialiser", demo: demoDemandee };
}
