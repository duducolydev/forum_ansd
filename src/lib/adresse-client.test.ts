import { describe, expect, it } from "vitest";
import { adresseClient } from "./adresse-client";

function entetes(valeurs: Record<string, string>): Headers {
  return new Headers(valeurs);
}

describe("adresse du visiteur (PLAN.md §18)", () => {
  it("prend X-Real-IP, posé par le reverse proxy", () => {
    expect(
      adresseClient(entetes({ "x-real-ip": "41.82.10.5", "x-forwarded-for": "1.2.3.4" })),
    ).toBe("41.82.10.5");
  });

  it("ignore le premier élément de X-Forwarded-For, que le client choisit", () => {
    // Ce que nginx transmettait : l'en-tête du client, puis l'adresse réelle.
    const forge = entetes({ "x-forwarded-for": "198.51.100.7, 41.82.10.5" });
    expect(adresseClient(forge)).toBe("41.82.10.5");
  });

  it("donne la même adresse quel que soit le préfixe forgé", () => {
    const adresses = new Set(
      Array.from({ length: 20 }, (_, i) =>
        adresseClient(entetes({ "x-forwarded-for": `198.51.100.${i}, 41.82.10.5` })),
      ),
    );
    expect([...adresses]).toEqual(["41.82.10.5"]);
  });

  it("tolère les espaces et les éléments vides", () => {
    expect(adresseClient(entetes({ "x-forwarded-for": " 41.82.10.5 , " }))).toBe("41.82.10.5");
    expect(adresseClient(entetes({ "x-real-ip": "  " }))).toBe("inconnue");
  });

  it("répond « inconnue » sans en-tête", () => {
    expect(adresseClient(entetes({}))).toBe("inconnue");
  });
});
