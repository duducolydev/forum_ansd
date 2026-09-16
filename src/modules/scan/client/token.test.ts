import { describe, expect, it } from "vitest";
import { buildBadgeToken, hashBadgeToken } from "@/modules/badges/token";
import { empreinteToken, extraireToken } from "./token";

const PUBLIC_ID = "FID26-7K3M2P";

describe("lecture d'un QR de badge par le scanner (brief §5.6)", () => {
  it("extrait le token de l'URL encodée dans le QR", () => {
    const token = buildBadgeToken(PUBLIC_ID, 1);
    expect(extraireToken(`https://forum.ansd.sn/v/${token}`)).toBe(token);
  });

  it("accepte le token nu, saisi à la main", () => {
    const token = buildBadgeToken(PUBLIC_ID, 1);
    expect(extraireToken(token)).toBe(token);
  });

  it("normalise la casse comme le fait le serveur", () => {
    const token = buildBadgeToken(PUBLIC_ID, 2);
    expect(extraireToken(token.toLowerCase())).toBe(token);
  });

  it("ne prend pas un nom de domaine pour un token", () => {
    expect(extraireToken("https://forum.ansd.sn/")).toBeNull();
    expect(extraireToken("bonjour")).toBeNull();
  });

  it("refuse une signature de longueur inattendue", () => {
    expect(extraireToken(`https://forum.ansd.sn/v/${PUBLIC_ID}.ABCDEF`)).toBeNull();
  });

  /**
   * Le test qui compte : si ces deux calculs divergeaient, **aucun badge** ne
   * serait reconnu hors ligne, et rien dans le typage ne le signalerait.
   */
  it("produit exactement l'empreinte que le serveur stocke en base", async () => {
    for (const version of [1, 2, 7]) {
      const token = buildBadgeToken(PUBLIC_ID, version);
      expect(await empreinteToken(token)).toBe(hashBadgeToken(token));
    }
  });

  it("mène de l'URL du QR à l'empreinte du badge en une passe", async () => {
    const token = buildBadgeToken(PUBLIC_ID, 3);
    const extrait = extraireToken(`https://forum.ansd.sn/v/${token}`);
    expect(extrait).not.toBeNull();
    expect(await empreinteToken(extrait!)).toBe(hashBadgeToken(token));
  });
});
