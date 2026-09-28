import { describe, expect, it } from "vitest";
import { listePresenceHtml } from "./pdf";
import { filtrerParPresence, lireFiltrePresence, type LigneListe } from "./service";

const JOUR = new Date("2026-11-23T00:00:00.000Z");

function ligne(nom: string, premierPassage: Date | null): LigneListe {
  return {
    publicId: nom,
    nom,
    organisation: null,
    categorie: "Délégué",
    pays: "Sénégal",
    premierPassage,
  };
}

const LIGNES = [
  ligne("SOW Aminata", new Date("2026-11-23T08:15:00.000Z")),
  ligne("OSEI Kwame", null),
  ligne("BA Oumar", new Date("2026-11-23T09:02:00.000Z")),
];

describe("filtre de présence de l'export", () => {
  it("garde tout le monde par défaut", () => {
    expect(filtrerParPresence(LIGNES, "TOUS")).toHaveLength(3);
  });

  it("ne garde que les présents, ou que les absents", () => {
    expect(filtrerParPresence(LIGNES, "PRESENTS").map((l) => l.nom)).toEqual([
      "SOW Aminata",
      "BA Oumar",
    ]);
    expect(filtrerParPresence(LIGNES, "ABSENTS").map((l) => l.nom)).toEqual(["OSEI Kwame"]);
  });

  it("retombe sur « tous » pour une valeur inconnue", () => {
    expect(lireFiltrePresence(null)).toBe("TOUS");
    expect(lireFiltrePresence("presents")).toBe("TOUS");
    expect(lireFiltrePresence("ABSENTS")).toBe("ABSENTS");
  });

  it("situe le nombre filtré par rapport aux attendus", () => {
    const html = listePresenceHtml({
      editionName: "Forum test",
      titre: "Liste des absents",
      sousTitre: "Toutes catégories",
      jour: JOUR,
      forme: "CONSTAT",
      lignes: filtrerParPresence(LIGNES, "ABSENTS"),
      filtre: "ABSENTS",
      attendus: LIGNES.length,
    });
    expect(html).toContain("1 absente(s) sur 3 attendue(s)");
    expect(html).not.toContain("SOW Aminata");
  });
});
