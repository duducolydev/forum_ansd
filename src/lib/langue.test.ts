import { describe, expect, it } from "vitest";
import { lireLangue, localeIntl, selon, traduire } from "./langue";

describe("langues du site", () => {
  it("replie le portugais sur l'anglais, puis sur le français", () => {
    expect(traduire("pt", { fr: "Bonjour", en: "Hello", pt: "Olá" })).toBe("Olá");
    expect(traduire("pt", { fr: "Bonjour", en: "Hello", pt: "  " })).toBe("Hello");
    expect(traduire("pt", { fr: "Bonjour", en: "", pt: null })).toBe("Bonjour");
  });

  it("replie l'anglais sur le français, jamais sur le portugais", () => {
    expect(traduire("en", { fr: "Bonjour", en: "", pt: "Olá" })).toBe("Bonjour");
    expect(traduire("fr", { fr: "Bonjour", en: "Hello", pt: "Olá" })).toBe("Bonjour");
  });

  it("ramène une langue inconnue au français", () => {
    expect(lireLangue("de")).toBe("fr");
    expect(lireLangue(undefined)).toBe("fr");
    expect(selon("es", { fr: "Oui", en: "Yes", pt: "Sim" })).toBe("Oui");
    expect(localeIntl("pt")).toBe("pt-PT");
  });
});
