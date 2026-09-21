import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ratioContraste } from "@/modules/settings/regles";

/**
 * Contraste de la palette, vérifié sur `globals.css` lui-même.
 *
 * Le test qui manquait. Trois couples de pastilles, le bouton d'action vert et
 * le contour de focus vivaient sous le seuil AA sans que rien ne le signale :
 * l'audit Lighthouse (T19) tournait en thème sombre, où ces jetons suivent le
 * motif inverse et passent, et aucun outil n'audite le contraste d'un contour
 * de focus. Chaque valeur ci-dessous a été mesurée, pas estimée.
 *
 * Le test lit la feuille de style plutôt qu'une copie des valeurs : une copie
 * aurait cessé de décrire le site à la première retouche.
 */

const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/**
 * Valeurs d'un jeton : la première déclaration est celle du thème clair, la
 * dernière celle du thème sombre (deux blocs sombres identiques suivent le bloc
 * clair). Les assertions de structure plus bas garantissent que cet ordre tient.
 */
function jeton(nom: string): { clair: string; sombre: string } {
  const trouvees = [...CSS.matchAll(new RegExp(`--${nom}:\\s*([^;]+);`, "g"))].map((m) =>
    m[1]!.trim(),
  );
  if (trouvees.length === 0) throw new Error(`Jeton --${nom} absent de globals.css`);
  return { clair: trouvees[0]!, sombre: trouvees[trouvees.length - 1]! };
}

function versRvb(couleur: string): [number, number, number] {
  // La feuille de style mélange les deux écritures (`#fff` et `#ffffff`).
  const court = couleur.match(/^#([0-9a-f]{3})$/i);
  if (court) {
    const p = court[1]!;
    return [0, 1, 2].map((i) => Number.parseInt(p[i]!.repeat(2), 16)) as [number, number, number];
  }
  const hex = couleur.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const p = hex[1]!;
    return [0, 2, 4].map((i) => Number.parseInt(p.slice(i, i + 2), 16)) as [number, number, number];
  }
  const rgba = couleur.match(/rgba?\(([^)]+)\)/i);
  if (rgba) {
    const parties = rgba[1]!.split(",").map((v) => Number.parseFloat(v.trim()));
    return [parties[0]!, parties[1]!, parties[2]!];
  }
  throw new Error(`Couleur non reconnue : ${couleur}`);
}

function alphaDe(couleur: string): number {
  const rgba = couleur.match(/rgba\(([^)]+)\)/i);
  if (!rgba) return 1;
  const parties = rgba[1]!.split(",").map((v) => Number.parseFloat(v.trim()));
  return parties[3] ?? 1;
}

function enHex(rvb: number[]): string {
  return `#${rvb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Aplatit un fond translucide sur la surface qui le porte : c'est la couleur
 * que l'œil voit, et donc celle qui compte pour le contraste. Les fonds adoucis
 * du thème sombre sont tous en `rgba`.
 */
function aplatir(couleur: string, surface: string): string {
  const alpha = alphaDe(couleur);
  if (alpha === 1) return enHex(versRvb(couleur));
  const dessus = versRvb(couleur);
  const dessous = versRvb(surface);
  return enHex(dessus.map((v, i) => alpha * v + (1 - alpha) * dessous[i]!));
}

/** Seuil AA du texte courant. Les pastilles sont en 12 px : pas de dérogation « grand texte ». */
const AA_TEXTE = 4.5;
/** Seuil AA non textuel (WCAG 1.4.11), pour un contour de focus. */
const AA_NON_TEXTE = 3;

const COUPLES = [
  { texte: "primary-text", fond: "primary", nom: "bouton d'action" },
  { texte: "accent-text", fond: "accent-soft", nom: "pastille verte" },
  { texte: "blue-text", fond: "blue-soft", nom: "pastille bleue" },
  { texte: "warn-text", fond: "warn-soft", nom: "pastille orange" },
  { texte: "danger-text", fond: "danger-soft", nom: "pastille rouge" },
  { texte: "gold-text", fond: "gold-soft", nom: "pastille dorée" },
  { texte: "btn-blue-text", fond: "btn-blue", nom: "bouton bleu" },
  { texte: "text", fond: "bg", nom: "texte courant" },
  { texte: "text-3", fond: "bg-3", nom: "texte atténué" },
  { texte: "heading", fond: "bg", nom: "titres" },
  { texte: "link", fond: "bg", nom: "liens" },
] as const;

describe("structure de globals.css", () => {
  it("déclare le thème clair avant les thèmes sombres", () => {
    // Toute la lecture ci-dessous repose sur cet ordre.
    expect(jeton("bg").clair).toBe("#ffffff");
    expect(jeton("bg").sombre).toBe("#061e38");
  });

  it("garde les deux blocs sombres alignés", () => {
    // Un bloc `@media prefers-color-scheme` et un bloc `[data-theme="dark"]`
    // décrivent le même thème : les laisser diverger produirait deux rendus
    // sombres différents selon que l'on a cliqué sur l'interrupteur ou non.
    const dangers = [...CSS.matchAll(/--danger-text:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(dangers).toHaveLength(3);
    expect(dangers[1]).toBe(dangers[2]);
  });
});

describe.each([
  ["clair", "clair" as const, "surface"],
  ["sombre", "sombre" as const, "surface"],
])("contraste du thème %s", (_libelle, variante, jetonSurface) => {
  const surface = jeton(jetonSurface)[variante];

  it.each(COUPLES.map((couple) => [couple.nom, couple.texte, couple.fond] as const))(
    "%s tient le seuil AA",
    (_nom, cleTexte, cleFond) => {
      const texte = aplatir(jeton(cleTexte)[variante], surface);
      const fond = aplatir(jeton(cleFond)[variante], surface);
      expect(ratioContraste(texte, fond)).toBeGreaterThanOrEqual(AA_TEXTE);
    },
  );

  it("le contour de focus se détache du fond de page", () => {
    const accent = jeton("ansd-or")[variante];
    const fond = jeton("bg")[variante];
    expect(ratioContraste(accent, fond)).toBeGreaterThanOrEqual(AA_NON_TEXTE);
  });

  it("le contour de focus se détache aussi des surfaces adoucies", () => {
    const accent = jeton("ansd-or")[variante];
    expect(ratioContraste(accent, jeton("bg-2")[variante])).toBeGreaterThanOrEqual(AA_NON_TEXTE);
  });
});

/**
 * Cascade : les règles d'élément doivent rester dans `@layer base`.
 *
 * Le défaut fermé ici est de ceux qu'aucune relecture ne voit. Tailwind v4
 * place ses utilitaires dans `@layer utilities` ; or une règle **hors calque**
 * bat toute règle en calque, quelle que soit sa spécificité. La règle
 * `h1,h2,h3,h4 { color: var(--heading) }`, écrite hors calque, l'emportait donc
 * sur chaque `text-*` posé sur un titre.
 *
 * Conséquence mesurée : le `<h2 className="text-white">` des colonnes du pied
 * de page restait à #0b4f8a sur le bandeau #082c4e, soit **1,69:1**. La classe
 * était bien présente dans le JSX ; elle perdait ailleurs.
 */
describe("cascade des styles de base", () => {
  const base = CSS.slice(CSS.indexOf("@layer base"));

  it("déclare les titres et le corps dans un calque", () => {
    expect(CSS).toContain("@layer base");
    for (const regle of ["h1,\n  h2,\n  h3,\n  h4 {", "body {", ":focus-visible {"]) {
      expect(base, regle).toContain(regle);
    }
  });

  it("ne laisse aucune règle d'élément hors calque", () => {
    // Tout ce qui précède `@layer base` ne doit contenir que des sélecteurs de
    // jetons (`:root`, media queries de thème) et le `@theme` de Tailwind.
    const avant = CSS.slice(0, CSS.indexOf("@layer base"));
    for (const element of ["h1", "h2", "h3", "h4", "body"]) {
      expect(avant, element).not.toMatch(new RegExp(`^\s*${element}\s*[,{]`, "m"));
    }
  });

  it("donne aux titres une taille et une graisse propres", () => {
    /*
     * Le `preflight` de Tailwind ramène les titres à la taille du texte
     * courant. Sans cette échelle, chaque `h1` du site s'affichait à 16 px en
     * graisse 400 — mesuré — et aucune page n'avait de hiérarchie visuelle.
     */
    const bloc = base.slice(base.indexOf("h1 {"), base.indexOf("h2 {"));
    expect(bloc).toMatch(/font-size:\s*clamp\(/);
    expect(bloc).toMatch(/font-weight:\s*700/);
  });
});

/**
 * Fond des sections « sombres » (PLAN.md §17).
 *
 * Une section sombre passe dans le thème sombre (`data-theme="dark"`) : ce sont
 * donc les textes **du thème sombre** qui se posent sur `--fond-sombre`, que la
 * page soit en thème clair ou en thème sombre. Le fond doit les porter tous, et
 * rester plus foncé que le fond adouci — c'est la demande.
 */
describe("fond des sections sombres", () => {
  const fond = jeton("fond-sombre");
  const TEXTES_DU_THEME_SOMBRE = [
    "text",
    "text-2",
    "text-3",
    "heading",
    "link",
    "accent-text",
    "blue-text",
  ] as const;
  // Contraste avec le noir : croît avec la clarté, donc sert à comparer deux fonds.
  const clarte = (couleur: string) => ratioContraste(couleur, "#000000");

  it.each([
    ["en thème clair", "clair"],
    ["en thème sombre", "sombre"],
  ] as const)("porte chaque texte du thème sombre %s", (_libelle, theme) => {
    for (const cle of TEXTES_DU_THEME_SOMBRE) {
      const texte = aplatir(jeton(cle).sombre, fond[theme]);
      expect(
        ratioContraste(texte, fond[theme]),
        `${cle} sur ${fond[theme]}`,
      ).toBeGreaterThanOrEqual(AA_TEXTE);
    }
  });

  it("est plus foncé que le fond adouci, dans les deux thèmes", () => {
    expect(clarte(fond.clair)).toBeLessThan(clarte(jeton("bg-2").clair));
    expect(clarte(fond.sombre)).toBeLessThan(clarte(jeton("bg-2").sombre));
  });

  it("se distingue du fond de page quand la page est en thème sombre", () => {
    // Sans cela, « Fond sombre » et « Fond clair » seraient identiques en thème sombre.
    expect(clarte(fond.sombre)).toBeLessThan(clarte(jeton("bg").sombre));
  });

  it("laisse le contour de focus visible", () => {
    for (const theme of ["clair", "sombre"] as const) {
      expect(ratioContraste(jeton("ansd-or").sombre, fond[theme])).toBeGreaterThanOrEqual(
        AA_NON_TEXTE,
      );
    }
  });

  it("déclare la même valeur sombre pour le réglage du système et pour l'interrupteur", () => {
    const valeurs = [...CSS.matchAll(/--fond-sombre:\s*([^;]+);/g)].map((m) => m[1]!.trim());
    expect(valeurs).toHaveLength(3);
    expect(valeurs[1]).toBe(valeurs[2]);
  });

  it('n\'est pas redéfini par le bloc [data-theme="dark"], dont la section hérite', () => {
    /*
     * La section sombre porte elle-même `data-theme="dark"`. Si ce bloc
     * définissait `--fond-sombre`, la section prendrait toujours la valeur du
     * thème sombre, même dans une page claire.
     */
    const debut = CSS.indexOf('[data-theme="dark"] {');
    const bloc = CSS.slice(debut, CSS.indexOf("}", debut));
    expect(bloc).not.toContain("--fond-sombre");
  });
});

/**
 * Bande défilante du haut de page (PLAN.md §19, §20).
 *
 * Son texte défile sur toute la largeur : il passe sur **chaque** arrêt du
 * dégradé, et doit tenir le seuil sur chacun, pas seulement en moyenne.
 */
describe("dégradé de la bande défilante", () => {
  const ARRETS = ["entete-debut", "entete-milieu", "entete-fin"] as const;

  it.each([["clair"], ["sombre"]] as const)(
    "garde le texte lisible sur chaque arrêt du dégradé en thème %s",
    (theme) => {
      const texte = jeton("entete-texte")[theme];
      for (const arret of ARRETS) {
        const fond = jeton(arret)[theme];
        expect(ratioContraste(texte, fond), `${texte} sur ${fond}`).toBeGreaterThanOrEqual(
          AA_TEXTE,
        );
      }
    },
  );

  it("déclare les mêmes couleurs pour le réglage du système et pour l'interrupteur", () => {
    for (const nom of [...ARRETS, "entete-texte"]) {
      const valeurs = [...CSS.matchAll(new RegExp(`--${nom}:\\s*([^;]+);`, "g"))].map((m) =>
        m[1]!.trim(),
      );
      expect(valeurs, nom).toHaveLength(3);
      expect(valeurs[1], nom).toBe(valeurs[2]);
    }
  });

  it("peint la bande par une classe réellement définie", () => {
    /*
     * Le défaut d'origine : `bg-ticker-bg text-ticker-text` supposaient des
     * jetons `--color-ticker-*` jamais déclarés dans `@theme`. Tailwind ne
     * générait aucune règle, et la bande est restée transparente sans que rien
     * ne le signale.
     */
    const lire = (fichier: string) =>
      readFileSync(join(process.cwd(), "src/components/site", fichier), "utf8");
    expect(lire("ticker.tsx")).toContain("fond-entete");
    expect(lire("site-header.tsx")).toContain("fond-navbar");
    for (const fichier of ["ticker.tsx", "site-header.tsx"]) {
      expect(lire(fichier), fichier).not.toMatch(/\b(bg|text)-ticker-/);
    }
    expect(CSS).toMatch(/\.fond-entete\s*\{[^}]*linear-gradient/);
    expect(CSS).toMatch(/\.fond-navbar\s*\{[^}]*linear-gradient/);
  });
});

/**
 * Barre de navigation bleu clair (PLAN.md §20).
 *
 * Le fond est le même dans les deux thèmes, pour le logo transparent : ses
 * textes et son contour de focus, en bleu nuit, doivent tenir sur chaque arrêt.
 */
describe("barre de navigation bleu clair", () => {
  const ARRETS = ["navbar-debut", "navbar-fin"] as const;
  const BLEU_NUIT = jeton("ansd-bleu-nuit").clair;

  it("garde le texte bleu nuit lisible sur chaque arrêt", () => {
    for (const arret of ARRETS) {
      const fond = jeton(arret).clair;
      expect(ratioContraste(BLEU_NUIT, fond), fond).toBeGreaterThanOrEqual(AA_TEXTE);
    }
  });

  it("garde lisible le texte bleu du logo transparent", () => {
    // Bleu de « INTERNATIONAL SUR LES DONNÉES », relevé dans le fichier du logo.
    for (const arret of ARRETS) {
      expect(ratioContraste("#0b57a4", jeton(arret).clair)).toBeGreaterThanOrEqual(AA_TEXTE);
    }
  });

  it("voit le contour de focus bleu nuit, et non l'or du site", () => {
    /*
     * L'or (`--ansd-or`) ne tient que 2,73:1 sur ce bleu clair : c'est pourquoi
     * les contrôles de la barre portent `focus-visible:outline-ansd-bleu-nuit`.
     */
    const plusFonce = jeton("navbar-fin").clair;
    expect(ratioContraste(jeton("ansd-or").clair, plusFonce)).toBeLessThan(AA_NON_TEXTE);
    for (const arret of ARRETS) {
      expect(ratioContraste(BLEU_NUIT, jeton(arret).clair)).toBeGreaterThanOrEqual(AA_NON_TEXTE);
    }
  });
});
