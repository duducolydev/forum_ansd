import { describe, expect, it } from "vitest";
import { abregerCivilite, avecCivilite } from "./civilite";

describe("civilité abrégée", () => {
  it("abrège les valeurs du formulaire d'inscription", () => {
    expect(abregerCivilite("Madame")).toBe("Mme");
    expect(abregerCivilite("Monsieur")).toBe("Mr");
    expect(abregerCivilite("Dr")).toBe("Dr");
    expect(abregerCivilite("Pr")).toBe("Pr");
    expect(abregerCivilite("SE")).toBe("SE");
  });

  it("reconnaît les saisies libres du BackOffice et de l'import", () => {
    expect(abregerCivilite("mme")).toBe("Mme");
    expect(abregerCivilite("M.")).toBe("Mr");
    expect(abregerCivilite("Professeur")).toBe("Pr");
    expect(abregerCivilite("S.E.")).toBe("SE");
    expect(abregerCivilite("Son Excellence")).toBe("SE");
    expect(abregerCivilite(" Docteur ")).toBe("Dr");
  });

  it("garde telle quelle une civilité inconnue, et rien quand elle est vide", () => {
    expect(abregerCivilite("Me")).toBe("Me");
    expect(abregerCivilite("")).toBe("");
    expect(abregerCivilite(null)).toBe("");
  });

  it("suit la langue demandée", () => {
    expect(abregerCivilite("SE", "en")).toBe("H.E.");
    expect(abregerCivilite("Pr", "pt")).toBe("Prof.");
  });

  it("préfixe le nom seulement s'il y a une civilité", () => {
    expect(avecCivilite("Dr", "Aminata SOW")).toBe("Dr Aminata SOW");
    expect(avecCivilite(null, "Aminata SOW")).toBe("Aminata SOW");
  });
});
