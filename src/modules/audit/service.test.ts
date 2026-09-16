import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { auditSearchSchema } from "./schema";
import { COLONNES_CSV, listerEntrees, ligneCsv } from "./service";

const identifiants: string[] = [];

async function ecrireEntree(quand: Date, action = "test.audit") {
  const entree = await prisma.auditLog.create({
    data: {
      actorType: "SYSTEM",
      action,
      entity: "TestAudit",
      entityId: `test-${crypto.randomUUID()}`,
      before: { valeur: 1 },
      after: { valeur: 2 },
      createdAt: quand,
    },
  });
  identifiants.push(entree.id);
  return entree;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { id: { in: identifiants } } });
  await prisma.$disconnect();
});

describe("filtres du journal d'audit", () => {
  it("inclut la journée entière de la borne haute", async () => {
    const jour = "2026-11-23";
    // 23 h 30 : une borne posée à minuit aurait masqué cette entrée, et le
    // journal aurait paru vide pour la journée que l'on cherche justement.
    const tard = await ecrireEntree(new Date(`${jour}T23:30:00.000Z`));

    const search = auditSearchSchema.parse({ du: jour, au: jour, entity: "TestAudit" });
    const { items } = await listerEntrees(search);

    expect(items.map((entree) => entree.id)).toContain(tard.id);
  });

  it("exclut ce qui tombe hors de la période", async () => {
    const dehors = await ecrireEntree(new Date("2026-11-25T10:00:00.000Z"));

    const search = auditSearchSchema.parse({
      du: "2026-11-23",
      au: "2026-11-24",
      entity: "TestAudit",
    });
    const { items } = await listerEntrees(search);

    expect(items.map((entree) => entree.id)).not.toContain(dehors.id);
  });

  it("filtre sur l'action", async () => {
    const cible = await ecrireEntree(new Date("2026-11-24T09:00:00.000Z"), "test.audit.rare");

    const { items } = await listerEntrees(auditSearchSchema.parse({ action: "test.audit.rare" }));

    expect(items.map((entree) => entree.id)).toEqual([cible.id]);
  });

  it("nomme « Système » un acteur sans utilisateur ni participant", async () => {
    const entree = await ecrireEntree(new Date("2026-11-24T11:00:00.000Z"), "test.audit.systeme");

    const { items } = await listerEntrees(
      auditSearchSchema.parse({ action: "test.audit.systeme" }),
    );

    expect(items[0]?.id).toBe(entree.id);
    expect(items[0]?.acteur).toBe("Système");
  });
});

describe("export CSV", () => {
  it("sérialise avant/après en JSON et respecte l'ordre des colonnes", async () => {
    const entree = await ecrireEntree(new Date("2026-11-24T12:00:00.000Z"), "test.audit.csv");
    const { items } = await listerEntrees(auditSearchSchema.parse({ action: "test.audit.csv" }));

    const ligne = ligneCsv(items[0]!);

    expect(ligne).toHaveLength(COLONNES_CSV.length);
    expect(ligne[1]).toBe("test.audit.csv");
    expect(ligne[3]).toBe(entree.entityId);
    expect(ligne[7]).toBe('{"valeur":1}');
    expect(ligne[8]).toBe('{"valeur":2}');
  });

  it("laisse une cellule vide plutôt que « null » quand il n'y a rien", () => {
    const ligne = ligneCsv({
      id: "x",
      createdAt: new Date("2026-11-24T12:00:00.000Z"),
      actorType: "SYSTEM",
      action: "test",
      entity: "Test",
      entityId: "1",
      ip: null,
      userAgent: null,
      before: null,
      after: null,
      acteur: "Système",
    });

    expect(ligne[7]).toBe("");
    expect(ligne[8]).toBe("");
  });
});
