import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ratioContraste } from "@/modules/settings/regles";

/**
 * Palette du site public (brief « Constellation »), mesurée sur
 * constellation.css elle-même — comme `palette.test.ts` pour globals.css.
 *
 * Trois blocs déclarent les jetons : clair (`.site-public`), sombre du
 * système, sombre choisi. On lit la première valeur (clair) et la dernière
 * (sombre), et l'on vérifie que les deux blocs sombres sont identiques.
 */

const CSS = readFileSync(join(process.cwd(), "src/app/constellation.css"), "utf8");

function valeurs(nom: string): string[] {
  return [...CSS.matchAll(new RegExp(`--${nom}:\\s*([^;]+);`, "g"))].map((m) => m[1]!.trim());
}

function jeton(nom: string): { clair: string; sombre: string } {
  const trouvees = valeurs(nom);
  if (trouvees.length === 0) throw new Error(`Jeton --${nom} absent de constellation.css`);
  return { clair: trouvees[0]!, sombre: trouvees[trouvees.length - 1]! };
}

const AA = 4.5;

const COUPLES = [
  ["text", "bg", "texte courant"],
  ["text-2", "bg", "texte secondaire"],
  ["text-3", "bg-3", "texte atténué sur le fond le plus soutenu"],
  ["text-2", "surface-2", "texte secondaire sur les sections alternées"],
  ["heading", "bg", "titres"],
  ["heading", "surface-2", "titres des sections alternées"],
  ["green-text", "bg", "étiquettes vertes"],
  ["green-text", "surface-2", "étiquettes vertes des sections alternées"],
  ["muted", "surface", "texte des cartes"],
  ["title", "surface", "titres des cartes"],
] as const;

describe("palette du site public", () => {
  it.each(["clair", "sombre"] as const)("tient le seuil AA en thème %s", (theme) => {
    for (const [texte, fond, nom] of COUPLES) {
      const couleurTexte = jeton(texte)[theme];
      const couleurFond = jeton(fond)[theme];
      expect(ratioContraste(couleurTexte, couleurFond), nom).toBeGreaterThanOrEqual(AA);
    }
  });

  it("déclare les mêmes valeurs sombres pour le système et pour l'interrupteur", () => {
    for (const [texte, fond] of COUPLES) {
      for (const nom of [texte, fond]) {
        const liste = valeurs(nom);
        expect(liste, nom).toHaveLength(3);
        expect(liste[1], nom).toBe(liste[2]);
      }
    }
  });

  it("garde le texte blanc lisible sur le dégradé des boutons verts", () => {
    for (const arret of ["#237033", "#287a37"]) {
      expect(ratioContraste("#ffffff", arret)).toBeGreaterThanOrEqual(AA);
    }
  });

  it("n'applique ses états masqués qu'une fois le script en main", () => {
    // Sans JavaScript, rien ne doit rester invisible.
    const masques = CSS.split("\n").filter((ligne) => /:not\(\[data-vu\]\)/.test(ligne));
    expect(masques.length).toBeGreaterThan(0);
    for (const ligne of masques) expect(ligne, ligne).toContain("html[data-motion]");
  });
});
