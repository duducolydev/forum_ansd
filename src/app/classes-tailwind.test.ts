import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Deux utilitaires Tailwind pour une même propriété, dans un même attribut.
 *
 * Le défaut fermé ici s'est produit deux fois pendant l'habillage du site
 * (§10.4) : `inline-flex block` sur un lien du pied de page, puis `py-14 py-16`
 * quand une page passait son rythme vertical par `className` à un composant qui
 * en posait déjà un.
 *
 * Il est invisible à la relecture et silencieux à l'exécution : ce n'est pas
 * l'ordre de l'attribut qui tranche, mais celui des règles dans la feuille de
 * style générée. Le résultat est donc juste sur une page et faux sur une autre,
 * sans rien dans la console. Ni TypeScript ni ESLint ne le voient.
 *
 * Le test lit les sources et refuse deux jetons de la même famille **sous le
 * même variant**. La précision compte : `hidden xl:inline-flex` est le motif
 * normal du responsive et doit rester permis, parce que les deux règles ne
 * s'appliquent jamais au même moment.
 */

const RACINES = ["src/components/site", "src/app/(public)", "src/app/(participant)"];

/** Familles surveillées : celles où le conflit est silencieux et courant. */
const FAMILLES: Record<string, RegExp> = {
  display:
    /^(block|inline-block|inline|flex|inline-flex|grid|inline-grid|hidden|contents|flow-root|table)$/,
  "padding-y": /^-?py-/,
  "padding-x": /^-?px-/,
  "padding-tout": /^-?p-/,
  position: /^(static|fixed|absolute|relative|sticky)$/,
};

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin));
    else if (chemin.endsWith(".tsx") || chemin.endsWith(".ts")) trouves.push(chemin);
  }
  return trouves;
}

/** Sépare `hover:xl:py-4` en son préfixe de variants et son utilitaire. */
function decouper(jeton: string): { variants: string; utilitaire: string } {
  const coupe = jeton.lastIndexOf(":");
  return coupe === -1
    ? { variants: "", utilitaire: jeton }
    : { variants: jeton.slice(0, coupe), utilitaire: jeton.slice(coupe + 1) };
}

function conflits(liste: string): string[] {
  const vus = new Map<string, string>();
  const trouves: string[] = [];

  for (const jeton of liste.split(/\s+/).filter(Boolean)) {
    // Les fragments d'interpolation (`${...}`) sont ignorés : la valeur n'est
    // pas connue statiquement.
    if (jeton.includes("$") || jeton.includes("{") || jeton.includes("}")) continue;

    const { variants, utilitaire } = decouper(jeton);
    for (const [famille, motif] of Object.entries(FAMILLES)) {
      if (!motif.test(utilitaire)) continue;
      const cle = `${variants}|${famille}`;
      const precedent = vus.get(cle);
      if (precedent && precedent !== jeton) trouves.push(`${precedent} + ${jeton}`);
      else vus.set(cle, jeton);
    }
  }
  return trouves;
}

describe("classes Tailwind du site public", () => {
  it("ne pose jamais deux utilitaires de la même propriété sous le même variant", () => {
    const defauts: string[] = [];

    for (const racine of RACINES) {
      for (const fichier of fichiers(racine)) {
        const source = readFileSync(fichier, "utf8");
        /*
         * On ne retient que les listes de classes : une chaîne d'au moins deux
         * mots, tirée d'un `className=` ou d'une constante de classes. Le
         * découpage grossier suffit — un faux positif serait une phrase
         * française contenant deux fois « flex », ce qui n'arrive pas.
         */
        for (const [, liste] of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
          for (const trouve of conflits(liste ?? "")) {
            defauts.push(`${fichier} : ${trouve}`);
          }
        }
        for (const [, liste] of source.matchAll(/^const [A-Z_]+ =\s*\n?\s*"([^"]*)";/gm)) {
          for (const trouve of conflits(liste)) defauts.push(`${fichier} : ${trouve}`);
        }
      }
    }

    expect(defauts).toEqual([]);
  });

  it("repère bien un conflit et laisse passer le motif responsive", () => {
    // Sans ces deux cas, un test qui ne trouve rien pourrait aussi bien ne rien
    // chercher.
    expect(conflits("inline-flex items-center block")).toEqual(["inline-flex + block"]);
    expect(conflits("mx-auto px-6 py-14 py-16")).toEqual(["py-14 + py-16"]);
    expect(conflits("hidden xl:inline-flex")).toEqual([]);
    expect(conflits("flex hover:flex")).toEqual([]);
  });
});
