import { describe, expect, it } from "vitest";
import {
  CLE_SANS_ORGANISATION,
  cleOrganisation,
  construireExtraction,
  filtrerLignes,
  lireColonnes,
  lireTypeExtraction,
  organisationsDistinctes,
  type LigneFiltrable,
} from "./extraction";

function ligne(
  nom: string,
  organisation: string | null,
  pays: string,
  present: boolean,
  categorie = "Délégué",
): LigneFiltrable {
  return {
    publicId: `ID-${nom}`,
    nom,
    organisation,
    fonction: null,
    categorie,
    pays,
    premierPassage: present ? new Date("2026-11-25T08:15:00.000Z") : null,
  };
}

const LIGNES = [
  ligne("SOW Aminata", "ANSD", "Sénégal", true),
  ligne("DIOP Moussa", "Ansd ", "Sénégal", false),
  ligne("KONE Awa", "INS Côte d'Ivoire", "Côte d'Ivoire", true, "Partenaire"),
  ligne("MARTIN Paul", "Banque mondiale", "France", false),
  ligne("BA Fatou", null, "Sénégal", true),
];

describe("organisations", () => {
  it("regroupe les écritures qui ne diffèrent que par la casse et les espaces", () => {
    expect(cleOrganisation("ANSD")).toBe(cleOrganisation("  ansd "));
    expect(cleOrganisation(null)).toBe(CLE_SANS_ORGANISATION);
    expect(cleOrganisation("   ")).toBe(CLE_SANS_ORGANISATION);
  });

  it("liste chaque organisation une fois, les non renseignées en dernier", () => {
    expect(organisationsDistinctes(LIGNES).map((o) => o.libelle)).toEqual([
      "ANSD",
      "Banque mondiale",
      "INS Côte d'Ivoire",
      "Organisation non renseignée",
    ]);
  });
});

describe("filtres de la liste", () => {
  it("filtre par organisation, toutes écritures confondues", () => {
    const retenues = filtrerLignes(LIGNES, {
      presence: "TOUS",
      organisation: cleOrganisation("ANSD"),
    });
    expect(retenues.map((l) => l.nom)).toEqual(["SOW Aminata", "DIOP Moussa"]);
  });

  it("retrouve les fiches sans organisation", () => {
    const retenues = filtrerLignes(LIGNES, {
      presence: "TOUS",
      organisation: CLE_SANS_ORGANISATION,
    });
    expect(retenues.map((l) => l.nom)).toEqual(["BA Fatou"]);
  });

  it("cumule présence, pays et recherche sans accents", () => {
    const retenues = filtrerLignes(LIGNES, {
      presence: "PRESENTS",
      pays: "Côte d'Ivoire",
      recherche: "cote",
    });
    expect(retenues.map((l) => l.nom)).toEqual(["KONE Awa"]);
  });
});

describe("extraction nominative", () => {
  it("sort les colonnes choisies, dans l'ordre canonique", () => {
    const extraction = construireExtraction(LIGNES, { presence: "PRESENTS" }, "NOMINATIVE", [
      "pays",
      "nom",
      "entree",
    ]);

    expect(extraction.titre).toBe("Liste des présents");
    expect(extraction.colonnes).toEqual(["Pays", "Nom", "Heure d'entrée"]);
    expect(extraction.lignes).toEqual([
      ["Sénégal", "SOW Aminata", "08:15"],
      ["Côte d'Ivoire", "KONE Awa", "08:15"],
      ["Sénégal", "BA Fatou", "08:15"],
    ]);
  });

  it("lit les colonnes de l'URL dans l'ordre canonique, sans les inconnues", () => {
    expect(lireColonnes("pays,nom,piege")).toEqual(["nom", "pays"]);
    expect(lireColonnes("")).toContain("nom");
    expect(lireTypeExtraction("PAYS")).toBe("PAYS");
    expect(lireTypeExtraction("AUTRE")).toBe("NOMINATIVE");
  });
});

describe("extraction par regroupement", () => {
  it("liste les organisations présentes, avec présents et attendus", () => {
    const extraction = construireExtraction(LIGNES, { presence: "PRESENTS" }, "ORGANISATIONS");

    expect(extraction.titre).toBe("Organisations présentes");
    expect(extraction.colonnes).toEqual(["Organisation", "Pays", "Présents", "Attendus"]);
    // La Banque mondiale, sans aucun présent, n'y figure pas ; l'ANSD compte
    // ses deux écritures comme une seule organisation.
    expect(extraction.lignes).toEqual([
      ["ANSD", "Sénégal", 1, 2],
      ["INS Côte d'Ivoire", "Côte d'Ivoire", 1, 1],
      ["Organisation non renseignée", "Sénégal", 1, 1],
    ]);
  });

  it("liste les pays présents, du plus représenté au moins représenté", () => {
    const extraction = construireExtraction(LIGNES, { presence: "PRESENTS" }, "PAYS");

    expect(extraction.titre).toBe("Pays présents");
    expect(extraction.lignes).toEqual([
      ["Sénégal", 2, 3],
      ["Côte d'Ivoire", 1, 1],
    ]);
  });

  it("garde tous les groupes sans filtre de présence", () => {
    const extraction = construireExtraction(LIGNES, { presence: "TOUS" }, "PAYS");

    expect(extraction.lignes.map((l) => l[0])).toEqual(["Sénégal", "Côte d'Ivoire", "France"]);
  });

  it("applique les autres filtres avant de regrouper", () => {
    const extraction = construireExtraction(
      LIGNES,
      { presence: "TOUS", categorie: "Partenaire" },
      "CATEGORIES",
    );

    expect(extraction.lignes).toEqual([["Partenaire", 1, 1]]);
  });
});
