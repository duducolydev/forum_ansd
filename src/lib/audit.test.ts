import { afterAll, describe, expect, it } from "vitest";
import { audit } from "./audit";
import { prisma } from "./db";

describe("audit.log (intégration DB)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { id: { in: createdIds } } });
    await prisma.$disconnect();
  });

  it("persists an immutable entry with before/after snapshots", async () => {
    await audit.log({
      actorType: "SYSTEM",
      action: "test.audit_log",
      entity: "TestEntity",
      entityId: "test-entity-1",
      before: { status: "A" },
      after: { status: "B" },
    });

    const entries = await prisma.auditLog.findMany({
      where: { entity: "TestEntity", entityId: "test-entity-1" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    createdIds.push(entry.id);

    expect(entry.actorType).toBe("SYSTEM");
    expect(entry.action).toBe("test.audit_log");
    expect(entry.before).toEqual({ status: "A" });
    expect(entry.after).toEqual({ status: "B" });
  });
});
