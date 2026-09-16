import { describe, expect, it } from "vitest";
import { empreinteDeChemin, urlVersionnee } from "./url-fichier";

describe("URL versionnée", () => {
  /*
   * Le défaut fermé ici s'est vu en usage réel : une illustration remplacée
   * continuait d'afficher l'ancienne image pendant dix minutes, parce que
   * l'URL de service ne dépend que de l'identifiant de la section, alors que le
   * cache la garde dix minutes.
   */
  it("tire l'empreinte du suffixe aléatoire du fichier", () => {
    expect(empreinteDeChemin("sections/abc123-461b2ede1fb1.jpg")).toBe("461b2ede1fb1");
    expect(empreinteDeChemin("sponsors/xyz-00cab971378f.svg")).toBe("00cab971378f");
  });

  it("laisse l'URL intacte quand le chemin n'a pas d'empreinte", () => {
    // Un chemin hérité, ou écrit à la main : mieux vaut une URL non versionnée
    // qu'une URL fausse.
    expect(urlVersionnee("/api/v1/sections/a/image", "sections/sans-suffixe")).toBe(
      "/api/v1/sections/a/image",
    );
    expect(urlVersionnee("/api/v1/sections/a/image", "")).toBe("/api/v1/sections/a/image");
  });

  it("produit une URL différente pour deux fichiers différents", () => {
    const base = "/api/v1/sections/abc/image";
    const avant = urlVersionnee(base, "sections/abc-5c555ff6a189.jpg");
    const apres = urlVersionnee(base, "sections/abc-461b2ede1fb1.jpg");
    expect(avant).not.toBe(apres);
  });
});
