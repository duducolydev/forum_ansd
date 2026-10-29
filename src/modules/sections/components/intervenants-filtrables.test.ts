import { describe, expect, it } from "vitest";
import { misEnAvantDabord } from "./intervenants-filtrables";

/** Section « Intervenants » de l'accueil, filtre « Tous » (29 octobre 2026). */
describe("intervenants de l'accueil sur « Tous »", () => {
  const fiche = (nom: string, isFeatured = false, featuredOrder = 0) => ({
    nom,
    isFeatured,
    featuredOrder,
  });

  it("garde tout le monde, les mis en avant d'abord dans leur ordre", () => {
    const liste = [
      fiche("ANNIM"),
      fiche("BIAYE", true, 2),
      fiche("CAMARA"),
      fiche("DIOP", true, 1),
      fiche("FAYE"),
    ];
    expect(misEnAvantDabord(liste).map((f) => f.nom)).toEqual([
      "DIOP",
      "BIAYE",
      "ANNIM",
      "CAMARA",
      "FAYE",
    ]);
  });

  it("laisse l'ordre alphabétique quand personne n'est mis en avant", () => {
    const liste = [fiche("ANNIM"), fiche("BIAYE"), fiche("CAMARA")];
    expect(misEnAvantDabord(liste)).toEqual(liste);
  });
});
