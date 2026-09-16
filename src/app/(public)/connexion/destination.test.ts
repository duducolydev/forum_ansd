import { describe, expect, it } from "vitest";
import { destinationSure } from "./destination";

const HOTE = "localhost:3010";

describe("destination après connexion", () => {
  it("garde un chemin du BackOffice ou du scanner", () => {
    expect(destinationSure("/scan", HOTE)).toBe("/scan");
    expect(destinationSure("/admin/participants?page=2", HOTE)).toBe("/admin/participants?page=2");
  });

  it("accepte l'adresse absolue que pose le middleware, pour ce site seulement", () => {
    expect(destinationSure("http://localhost:3010/scan", HOTE)).toBe("/scan");
    expect(destinationSure("https://site-tiers.example/scan", HOTE)).toBeNull();
  });

  it("refuse tout ce qui ressortirait vers un autre site", () => {
    // Les trois formes classiques de redirection ouverte.
    expect(destinationSure("//site-tiers.example/admin", HOTE)).toBeNull();
    expect(destinationSure("/\\site-tiers.example/admin", HOTE)).toBeNull();
    expect(destinationSure("javascript:alert(1)", HOTE)).toBeNull();
  });

  it("refuse les destinations qui ne relèvent pas de ce formulaire", () => {
    expect(destinationSure("/", HOTE)).toBeNull();
    expect(destinationSure("/mon-espace", HOTE)).toBeNull();
    // Un préfixe de nom n'est pas un sous-chemin.
    expect(destinationSure("/administration-piege", HOTE)).toBeNull();
    expect(destinationSure("", HOTE)).toBeNull();
    expect(destinationSure("scan", HOTE)).toBeNull();
  });
});
