import type { Permission } from "./permissions";

export interface SessionLike {
  user?: {
    permissions?: readonly string[];
  } | null;
}

/**
 * RBAC déclaratif (brief §3.3, §12) : `can(session, "participants.export")`.
 * Les permissions de la session sont relues en base à chaque `auth()`
 * (`src/modules/auth/revalidation.ts`) : un changement de rôle prend effet à la
 * requête suivante (PLAN.md §18, qui lève la limite T13).
 */
export function can(session: SessionLike | null | undefined, permission: Permission): boolean {
  return Boolean(session?.user?.permissions?.includes(permission));
}
