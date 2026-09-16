import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le scanner s'installe comme une application (PLAN.md §16.7).
 *
 * Chrome sur Android ne propose l'installation qu'avec des icônes de 192 et
 * 512 px ; le manifeste n'en déclarait qu'une de 48. Ce test lit le manifeste
 * **et les fichiers** : une icône déclarée mais absente, ou dont la taille réelle
 * ne correspond pas à celle annoncée, empêcherait l'installation sans message.
 */

const PUBLIC = join(process.cwd(), "public");

interface Icone {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

/** Largeur, hauteur et type de couleur, lus dans l'en-tête PNG. */
function lirePng(chemin: string) {
  const octets = readFileSync(chemin);
  expect(octets.subarray(1, 4).toString("ascii"), chemin).toBe("PNG");
  return {
    largeur: octets.readUInt32BE(16),
    hauteur: octets.readUInt32BE(20),
    // 2 : couleurs vraies sans alpha ; 6 : avec alpha.
    typeCouleur: octets[25],
  };
}

const manifeste = JSON.parse(readFileSync(join(PUBLIC, "scan.webmanifest"), "utf8")) as {
  icons: Icone[];
  start_url: string;
  scope: string;
  display: string;
};

describe("installation du scanner", () => {
  it("déclare les icônes qu'exige Chrome, dont une pour les formes découpées", () => {
    const annonce = (taille: string, usage: string) =>
      manifeste.icons.some(
        (icone) =>
          icone.sizes === taille &&
          icone.type === "image/png" &&
          (icone.purpose ?? "any").split(" ").includes(usage),
      );

    expect(annonce("192x192", "any")).toBe(true);
    expect(annonce("512x512", "any")).toBe(true);
    expect(annonce("512x512", "maskable")).toBe(true);
  });

  it("fournit chaque icône déclarée, à la taille annoncée", () => {
    for (const icone of manifeste.icons) {
      const chemin = join(PUBLIC, icone.src);
      expect(existsSync(chemin), icone.src).toBe(true);

      const [largeur, hauteur] = icone.sizes.split("x").map(Number);
      const png = lirePng(chemin);
      expect([png.largeur, png.hauteur], icone.src).toEqual([largeur, hauteur]);
    }
  });

  it("fournit à iOS une icône opaque de 180 px", () => {
    // iOS remplit la transparence en noir : l'icône doit être opaque.
    const png = lirePng(join(PUBLIC, "icons", "scan-apple-180.png"));
    expect([png.largeur, png.hauteur]).toEqual([180, 180]);
    expect(png.typeCouleur).toBe(2);
  });

  it("s'ouvre sur le scanner et reste dans son périmètre", () => {
    expect(manifeste.start_url).toBe("/scan");
    expect(manifeste.scope).toBe("/scan");
    expect(["fullscreen", "standalone"]).toContain(manifeste.display);
  });
});
