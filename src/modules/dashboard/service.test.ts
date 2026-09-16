import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getDashboardData, topBreakdown } from "./service";

describe("topBreakdown", () => {
  it("trie par valeur décroissante", () => {
    const rows = topBreakdown([
      { label: "a", value: 2 },
      { label: "b", value: 9 },
      { label: "c", value: 5 },
    ]);
    expect(rows.map((r) => r.label)).toEqual(["b", "c", "a"]);
  });

  it("replie la traîne dans « Autres » au-delà de la limite", () => {
    const rows = topBreakdown(
      Array.from({ length: 12 }, (_, i) => ({ label: `p${i}`, value: 12 - i })),
      8,
    );
    expect(rows).toHaveLength(9);
    expect(rows[8]!.label).toBe("Autres (4)");
    // 4 + 3 + 2 + 1
    expect(rows[8]!.value).toBe(10);
  });

  it("ne fabrique pas de ligne « Autres » quand tout tient", () => {
    const rows = topBreakdown([{ label: "a", value: 1 }], 8);
    expect(rows).toEqual([{ label: "a", value: 1 }]);
  });

  it("conserve le total quel que soit le repli", () => {
    const source = Array.from({ length: 20 }, (_, i) => ({ label: `p${i}`, value: i + 1 }));
    const total = source.reduce((sum, row) => sum + row.value, 0);
    const folded = topBreakdown(source, 5).reduce((sum, row) => sum + row.value, 0);
    expect(folded).toBe(total);
  });
});

describe("agrégats du tableau de bord (brief §13)", () => {
  let editionId = "";

  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("produit un entonnoir monotone décroissant", async () => {
    const { funnel } = await getDashboardData(editionId);
    expect(funnel).toHaveLength(5);
    for (let i = 1; i < funnel.length; i++) {
      // Une étape ne peut pas dépasser la précédente : sinon le graphique
      // raconterait une conversion supérieure à 100 %.
      expect(funnel[i]!.value).toBeLessThanOrEqual(funnel[i - 1]!.value);
    }
  });

  it("garde les indicateurs cohérents entre eux", async () => {
    const { kpis } = await getDashboardData(editionId);

    expect(kpis.confirmed).toBeLessThanOrEqual(kpis.registered);
    expect(kpis.badgesGenerated).toBeLessThanOrEqual(kpis.confirmed);
    // Tout inscrit est soit national, soit international : jamais les deux,
    // jamais aucun.
    expect(kpis.national + kpis.international).toBe(kpis.registered);

    if (kpis.registered > 0) {
      expect(kpis.confirmationRate).toBe(Math.round((kpis.confirmed / kpis.registered) * 100));
      expect(kpis.confirmationRate).toBeGreaterThanOrEqual(0);
      expect(kpis.confirmationRate).toBeLessThanOrEqual(100);
    } else {
      expect(kpis.confirmationRate).toBeNull();
    }
  });

  it("répartit les inscrits sans en perdre ni en inventer", async () => {
    const { kpis, byCategory, byCountry } = await getDashboardData(editionId);

    const parCategorie = byCategory.reduce((sum, row) => sum + row.value, 0);
    expect(parCategorie).toBe(kpis.registered);

    const parPays = byCountry.reduce((sum, row) => sum + row.value, 0);
    expect(parPays).toBe(kpis.registered);
  });

  it("renvoie une courbe par jour ordonnée et sans doublon", async () => {
    const { registrationsPerDay } = await getDashboardData(editionId);
    const jours = registrationsPerDay.map((point) => point.day);

    expect(new Set(jours).size).toBe(jours.length);
    expect([...jours].sort()).toEqual(jours);
    for (const point of registrationsPerDay) {
      expect(point.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(point.value).toBeGreaterThan(0);
    }
  });
});
