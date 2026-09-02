import type { AuditActorType, Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface AuditLogInput {
  actorType: AuditActorType;
  actorUserId?: string;
  actorParticipantId?: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}

/**
 * Journal d'audit immuable (brief §3.3, D9) : à appeler depuis chaque service
 * `service.ts` de `modules/<domaine>/` qui effectue une écriture sensible. La
 * table `AuditLog` est append-only — aucune méthode `update`/`delete` n'est
 * exposée ici volontairement.
 */
export const audit = {
  async log(input: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        actorType: input.actorType,
        actorUserId: input.actorUserId,
        actorParticipantId: input.actorParticipantId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: input.before as Prisma.InputJsonValue | undefined,
        after: input.after as Prisma.InputJsonValue | undefined,
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  },
};
