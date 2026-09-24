import { describe, expect, it } from "vitest";
import { datesDuForum } from "./dates";

/** Les dates sont stockées à minuit UTC, comme le seed les écrit. */
function jour(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("dates du Forum sur le badge", () => {
  it("factorise le mois et l'année quand le Forum tient dans un mois", () => {
    expect(datesDuForum(jour("2026-11-23"), jour("2026-11-25"))).toBe("23–25 novembre 2026");
  });

  it("répète le mois quand le Forum chevauche deux mois", () => {
    expect(datesDuForum(jour("2026-11-30"), jour("2026-12-02"))).toBe(
      "30 novembre – 2 décembre 2026",
    );
  });

  it("répète l'année quand le Forum chevauche deux années", () => {
    expect(datesDuForum(jour("2026-12-30"), jour("2027-01-02"))).toBe(
      "30 décembre 2026 – 2 janvier 2027",
    );
  });

  it("n'écrit qu'une date pour un événement d'un jour", () => {
    expect(datesDuForum(jour("2026-11-23"), jour("2026-11-23"))).toBe("23 novembre 2026");
  });

  it("ne décale pas la date d'un jour à cause du fuseau", () => {
    /*
     * Le serveur tourne en UTC et les dates sont à minuit. Sans fuseau
     * explicite, une machine réglée à l'ouest de Greenwich afficherait la
     * veille — un badge pour un Forum qui ouvre le lendemain.
     */
    expect(datesDuForum(jour("2026-11-23"), jour("2026-11-25"))).toContain("23");
  });
});
