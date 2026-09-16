import { describe, expect, it } from "vitest";
import { resolveLocaleValue } from "./service";

describe("resolveLocaleValue (repli FR si EN vide — brief §10)", () => {
  it("returns the French value for the fr locale", () => {
    expect(resolveLocaleValue("Bonjour", "Hello", "fr")).toBe("Bonjour");
  });

  it("returns the English value when present for the en locale", () => {
    expect(resolveLocaleValue("Bonjour", "Hello", "en")).toBe("Hello");
  });

  it("falls back to French when the English value is empty", () => {
    expect(resolveLocaleValue("Bonjour", "", "en")).toBe("Bonjour");
    expect(resolveLocaleValue("Bonjour", "   ", "en")).toBe("Bonjour");
    expect(resolveLocaleValue("Bonjour", undefined, "en")).toBe("Bonjour");
  });

  it("returns an empty string when neither value is a string", () => {
    expect(resolveLocaleValue(null, null, "fr")).toBe("");
  });
});
