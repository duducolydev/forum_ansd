import { describe, expect, it } from "vitest";
import { nomPropose } from "./bouton-export-zip";

/**
 * Tant que l'export passait par un lien, le navigateur lisait lui-même
 * `Content-Disposition`. Depuis qu'il passe par `fetch`, c'est notre affaire :
 * un en-tête mal analysé produit un fichier nommé « badges.zip » au mieux,
 * « download » sans extension au pire.
 */
describe("nom de fichier proposé", () => {
  it("lit le nom entre guillemets", () => {
    expect(nomPropose('attachment; filename="badges-2026-11-18.zip"', "badges.zip")).toBe(
      "badges-2026-11-18.zip",
    );
  });

  it("lit un nom sans guillemets", () => {
    expect(nomPropose("attachment; filename=badges-tous.zip", "badges.zip")).toBe(
      "badges-tous.zip",
    );
  });

  it("décode la forme encodée des noms accentués", () => {
    expect(
      nomPropose("attachment; filename*=UTF-8''badges-d%C3%A9l%C3%A9gation.zip", "x.zip"),
    ).toBe("badges-délégation.zip");
  });

  it("retombe sur le nom par défaut quand l'en-tête manque ou ne dit rien", () => {
    expect(nomPropose(null, "badges.zip")).toBe("badges.zip");
    expect(nomPropose("attachment", "badges.zip")).toBe("badges.zip");
  });

  it("ne confond pas un paramètre voisin avec le nom", () => {
    expect(nomPropose('attachment; size=12; filename="badges.zip"', "defaut.zip")).toBe(
      "badges.zip",
    );
  });
});
