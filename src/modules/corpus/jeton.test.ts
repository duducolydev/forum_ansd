import { describe, expect, it } from "vitest";
import { jetonDeLaRequete, jetonValide } from "./jeton";

describe("jetonValide", () => {
  it("laisse passer quand aucun jeton n'est configuré", () => {
    expect(jetonValide(null, undefined)).toBe(true);
    expect(jetonValide(null, "")).toBe(true);
    expect(jetonValide(null, "   ")).toBe(true);
  });

  it("accepte le bon jeton, espaces de transport compris", () => {
    expect(jetonValide("secret-attendu", "secret-attendu")).toBe(true);
    expect(jetonValide("  secret-attendu  ", "secret-attendu")).toBe(true);
  });

  it("refuse un jeton absent, vide ou faux", () => {
    expect(jetonValide(null, "secret-attendu")).toBe(false);
    expect(jetonValide("", "secret-attendu")).toBe(false);
    expect(jetonValide("   ", "secret-attendu")).toBe(false);
    expect(jetonValide("secret-attend", "secret-attendu")).toBe(false);
    expect(jetonValide("secret-attendu-et-plus", "secret-attendu")).toBe(false);
  });

  it("ne lève pas sur un jeton de longueur différente", () => {
    // `timingSafeEqual` exige des tampons de même taille : sans les empreintes,
    // cet appel jetterait, et la longueur du secret deviendrait observable.
    expect(() => jetonValide("x", "un-secret-beaucoup-plus-long")).not.toThrow();
  });
});

describe("jetonDeLaRequete", () => {
  function entetes(valeurs: Record<string, string>) {
    return {
      get: (nom: string) => valeurs[nom.toLowerCase()] ?? null,
    };
  }

  it("lit « Authorization: Bearer », quelle que soit la casse", () => {
    expect(jetonDeLaRequete(entetes({ authorization: "Bearer abc123" }))).toBe("abc123");
    expect(jetonDeLaRequete(entetes({ authorization: "bearer abc123" }))).toBe("abc123");
    expect(jetonDeLaRequete(entetes({ authorization: "BEARER   abc123" }))).toBe("abc123");
  });

  it("lit l'en-tête dédié à défaut", () => {
    expect(jetonDeLaRequete(entetes({ "x-corpus-token": "abc123" }))).toBe("abc123");
  });

  it("ignore un autre schéma d'autorisation", () => {
    expect(jetonDeLaRequete(entetes({ authorization: "Basic abc123" }))).toBeNull();
  });

  it("renvoie null sans en-tête", () => {
    expect(jetonDeLaRequete(entetes({}))).toBeNull();
  });
});
