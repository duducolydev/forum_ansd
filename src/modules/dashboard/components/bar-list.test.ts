import { describe, expect, it } from "vitest";
import { libelleAbrege } from "./bar-list";

/**
 * Ce qui est vérifié ici, c'est qu'un libellé reste **reconnaissable une fois
 * coupé**. La colonne tronque par la fin : tout ce qui distingue deux noms doit
 * donc tenir au début.
 */
describe("abrégé des libellés", () => {
  it("remonte le sigle en tête, là où la troncature ne l'atteint pas", () => {
    expect(libelleAbrege("Agence Nationale de la Statistique et de la Démographie (ANSD)")).toBe(
      "ANSD — Agence Nationale de la Statistique et de la Démographie",
    );
  });

  it("laisse intact un libellé sans sigle final", () => {
    expect(libelleAbrege("Sénégal")).toBe("Sénégal");
    expect(libelleAbrege("Université Cheikh Anta Diop")).toBe("Université Cheikh Anta Diop");
  });

  it("ignore une parenthèse qui n'est pas un sigle", () => {
    // Trop longue pour être un sigle : la remonter en tête masquerait le nom.
    const libelle = "Institut de recherche (anciennement Centre national d'études)";
    expect(libelleAbrege(libelle)).toBe(libelle);
  });

  it("ignore une parenthèse en milieu de libellé", () => {
    const libelle = "Agence (ANSD) de la Statistique";
    expect(libelleAbrege(libelle)).toBe(libelle);
  });

  it("ne renvoie pas un libellé vide quand le nom se réduit au sigle", () => {
    expect(libelleAbrege("(ANSD)")).toBe("(ANSD)");
  });
});
