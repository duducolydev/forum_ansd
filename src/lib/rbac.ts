import type { Permission } from "./permissions";

export interface SessionLike {
  user?: {
    permissions?: readonly string[];
  } | null;
}

/**
 * RBAC déclaratif (brief §3.3, §12) : `can(session, "participants.export")`.
 * Les permissions sont résolues au moment de la connexion (`src/auth.ts`) et
 * embarquées dans le token de session — un changement de rôle ne prend donc
 * effet qu'à la reconnexion (limite acceptée pour le Lot 0, cf. PLAN.md T13).
 */
export function can(session: SessionLike | null | undefined, permission: Permission): boolean {
  return Boolean(session?.user?.permissions?.includes(permission));
}
