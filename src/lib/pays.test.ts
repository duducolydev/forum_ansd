import { describe, expect, it } from "vitest";
import {
  PAYS,
  cleDePays,
  estPaysDeReference,
  libellePays,
  normaliserPays,
  trouverPays,
} from "./pays";
import { schemaPaysDeLaListe, schemaPaysFacultatif, schemaPaysObligatoire } from "./pays-schema";

describe("liste des pays", () => {
  it("compte chaque pays une fois, code et nom français uniques", () => {
    expect(PAYS.length).toBeGreaterThan(230);
    expect(new Set(PAYS.map((pays) => pays.code)).size).toBe(PAYS.length);
    expect(new Set(PAYS.map((pays) => cleDePays(pays.fr))).size).toBe(PAYS.length);
  });

  it("retient les usages du Forum pour les deux Congo et la Côte d'Ivoire", () => {
    expect(trouverPays("CD")?.fr).toBe("République démocratique du Congo");
    expect(trouverPays("CG")?.fr).toBe("Congo");
    expect(trouverPays("CI")?.fr).toBe("Côte d'Ivoire");
  });
});

describe("reconnaissance d'une saisie libre", () => {
  it.each([
    ["Sénégal", "Sénégal"],
    ["Senegal", "Sénégal"],
    ["SENEGAL", "Sénégal"],
    ["  sénégal ", "Sénégal"],
    ["Sn", "Sénégal"],
    ["SN", "Sénégal"],
    ["SEN", "Sénégal"],
    ["Cote d'ivoire", "Côte d'Ivoire"],
    ["Côte d’Ivoire", "Côte d'Ivoire"],
    ["Ivory Coast", "Côte d'Ivoire"],
    ["RDC", "République démocratique du Congo"],
    ["Congo-Kinshasa", "République démocratique du Congo"],
    ["Congo Brazzaville", "Congo"],
    ["Guinée Bissau", "Guinée-Bissau"],
    ["Cabo Verde", "Cap-Vert"],
    ["USA", "États-Unis"],
    ["Etats Unis", "États-Unis"],
    ["France", "France"],
    ["Burkina", "Burkina Faso"],
    ["Guinée Conakry", "Guinée"],
    ["RCA", "République centrafricaine"],
    ["Dakar", null],
  ])("« %s » → %s", (saisie, attendu) => {
    expect(trouverPays(saisie)?.fr ?? null).toBe(attendu);
  });

  it("garde une saisie inconnue plutôt que de la perdre", () => {
    expect(normaliserPays(" Dakar ")).toBe("Dakar");
    expect(normaliserPays("sn")).toBe("Sénégal");
  });

  it("ne tient pour harmonisé que le nom de référence exact", () => {
    expect(estPaysDeReference("Sénégal")).toBe(true);
    expect(estPaysDeReference("Senegal")).toBe(false);
    expect(estPaysDeReference("Sénégal ")).toBe(false);
    expect(estPaysDeReference("Dakar")).toBe(false);
  });

  it("donne le nom dans la langue de la page", () => {
    expect(libellePays("Sénégal", "en")).toBe("Senegal");
    expect(libellePays("Côte d'Ivoire", "pt")).toBe("Costa do Marfim");
    expect(libellePays("Dakar", "en")).toBe("Dakar");
  });
});

describe("validation du pays", () => {
  it("normalise avant d'enregistrer", () => {
    expect(schemaPaysObligatoire.parse("senegal")).toBe("Sénégal");
    expect(schemaPaysFacultatif.parse("sn")).toBe("Sénégal");
    expect(schemaPaysFacultatif.parse("")).toBe("");
  });

  it("exige un pays, et un pays de la liste sur les formulaires publics", () => {
    expect(schemaPaysObligatoire.safeParse("").success).toBe(false);
    expect(schemaPaysObligatoire.parse("Dakar")).toBe("Dakar");
    const refus = schemaPaysDeLaListe.safeParse("Dakar");
    expect(refus.success).toBe(false);
    expect(refus.error?.issues[0]?.message).toBe("Choisissez un pays dans la liste");
    expect(schemaPaysDeLaListe.parse("Guinée Bissau")).toBe("Guinée-Bissau");
  });
});
