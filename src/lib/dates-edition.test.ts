import { describe, expect, it } from "vitest";
import { plageDeDates } from "./dates-edition";

const jour = (iso: string) => new Date(`${iso}T08:00:00.000Z`);

describe("dates de l'édition", () => {
  it("écrit une plage dans le même mois d'un seul tenant", () => {
    expect(plageDeDates(jour("2026-11-23"), jour("2026-11-25"), "fr")).toBe(
      "23 - 25 Novembre 2026",
    );
    expect(plageDeDates(jour("2026-11-23"), jour("2026-11-25"), "en")).toBe(
      "23 - 25 November 2026",
    );
  });

  it("relie jour, mois et année par « de » en portugais", () => {
    expect(plageDeDates(jour("2026-11-23"), jour("2026-11-25"), "pt")).toBe(
      "23 - 25 de Novembro de 2026",
    );
  });

  it("répète le mois quand la plage en change", () => {
    expect(plageDeDates(jour("2026-11-30"), jour("2026-12-02"), "fr")).toBe(
      "30 Novembre - 2 Décembre 2026",
    );
  });
});
