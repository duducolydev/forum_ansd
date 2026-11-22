import { describe, expect, it } from "vitest";
import { bornesDuJour, jourValide, lireFiltreBadges } from "./filtre";

function lire(parametres: Record<string, string>) {
  return lireFiltreBadges((cle) => parametres[cle]);
}

describe("lecture du filtre de l'URL", () => {
  it("lit tous les champs connus", () => {
    expect(lire({ categoryId: "c1", delegationId: "d1", etat: "AVEC", export: "JAMAIS" })).toEqual({
      categoryId: "c1",
      delegationId: "d1",
      etat: "AVEC",
      export: "JAMAIS",
      exporteLe: undefined,
    });
  });

  it("écarte les valeurs inconnues plutôt que d'échouer", () => {
    expect(lire({ etat: "TOUT", export: "PEUTETRE", exporteLe: "hier" })).toEqual({
      categoryId: undefined,
      delegationId: undefined,
      etat: undefined,
      export: undefined,
      exporteLe: undefined,
    });
  });

  it("laisse le jour d'export l'emporter sur l'état d'envoi", () => {
    const filtre = lire({ export: "JAMAIS", exporteLe: "2026-11-21" });

    expect(filtre.export).toBeUndefined();
    expect(filtre.exporteLe).toBe("2026-11-21");
  });
});

describe("jour d'export", () => {
  it("refuse une date qui n'existe pas", () => {
    expect(jourValide("2026-02-31")).toBeUndefined();
    expect(jourValide("2026-11-21")).toBe("2026-11-21");
  });

  it("couvre la journée entière, minuit exclu le lendemain", () => {
    expect(bornesDuJour("2026-11-21")).toEqual({
      gte: new Date("2026-11-21T00:00:00.000Z"),
      lt: new Date("2026-11-22T00:00:00.000Z"),
    });
  });
});
