import { describe, expect, it } from "vitest";
import {
  ajusterPourFonds,
  assombrirJusquAuSeuil,
  BLANC,
  CONTRASTE_MIN,
  CONTRASTE_MIN_LARGE,
  etatInscriptions,
  FONDS_PAGE,
  formaterRatio,
  ratioContraste,
  texteSur,
  verifierCouleur,
  verifierSurFonds,
} from "./regles";
import { INSCRIPTIONS_PAR_DEFAUT } from "./schema";
import { cssDuTheme } from "./theme-css";
import { THEME_PAR_DEFAUT } from "./schema";

const le = (jour: string) => new Date(`${jour}T09:00:00.000Z`);

describe("fenêtre d'inscription", () => {
  const fenetre = {
    ...INSCRIPTIONS_PAR_DEFAUT,
    ouvertureLe: "2026-10-05",
    fermetureLe: "2026-11-16",
  };

  it("ouvre le jour de l'ouverture, pas le lendemain", () => {
    expect(etatInscriptions(fenetre, le("2026-10-04")).ouvertes).toBe(false);
    expect(etatInscriptions(fenetre, le("2026-10-05")).ouvertes).toBe(true);
  });

  it("laisse la journée de fermeture entière", () => {
    // La borne haute est incluse : fermer « le 16 » ne ferme pas le 15 au soir.
    expect(etatInscriptions(fenetre, new Date("2026-11-16T23:59:00.000Z")).ouvertes).toBe(true);
    expect(etatInscriptions(fenetre, le("2026-11-17")).ouvertes).toBe(false);
  });

  it("annonce le jour d'ouverture tant qu'il n'est pas atteint", () => {
    const etat = etatInscriptions(fenetre, le("2026-09-30"));
    expect(etat.motif).toBe("PAS_ENCORE");
    expect(etat.ouvreLe).toBe("2026-10-05");
  });

  it("distingue une fenêtre dépassée d'une fenêtre pas encore atteinte", () => {
    expect(etatInscriptions(fenetre, le("2026-12-01")).motif).toBe("TERMINEES");
  });

  it("laisse l'interrupteur primer sur les dates", () => {
    const ferme = { ...fenetre, active: false };
    expect(etatInscriptions(ferme, le("2026-10-20")).motif).toBe("DESACTIVEES");
  });

  it("reste ouverte sans aucune date", () => {
    expect(etatInscriptions(INSCRIPTIONS_PAR_DEFAUT, le("2026-01-01")).ouvertes).toBe(true);
  });
});

describe("contraste", () => {
  it("retrouve les valeurs de référence WCAG", () => {
    expect(ratioContraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(ratioContraste("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });

  it("retrouve les ratios mesurés lors de l'audit T34", () => {
    // Le bouton bleu vif de la charte, écarté parce qu'il ne tenait pas AA…
    expect(ratioContraste("#2f7fd1", BLANC)).toBeCloseTo(4.14, 1);
    // …et le bleu retenu à sa place.
    expect(ratioContraste("#1d5a9c", BLANC)).toBeCloseTo(7.01, 1);
  });

  it("choisit le texte qui contraste le mieux", () => {
    expect(texteSur("#082c4e")).toBe(BLANC);
    expect(texteSur("#e9a824")).toBe("#12212f");
  });

  it("juge conformes les couleurs par défaut du thème", () => {
    expect(verifierCouleur(THEME_PAR_DEFAUT.primaire).conforme).toBe(true);
    expect(verifierCouleur(THEME_PAR_DEFAUT.secondaire).conforme).toBe(true);
  });

  it("assombrit jusqu'à franchir le seuil, et pas au-delà du nécessaire", () => {
    const corrigee = assombrirJusquAuSeuil("#7fd1a0");
    expect(ratioContraste(corrigee, BLANC)).toBeGreaterThanOrEqual(CONTRASTE_MIN);
  });

  it("formate le ratio à la française", () => {
    expect(formaterRatio(7.0128)).toBe("7,01:1");
  });
});

describe("couleur d'accent sur les deux fonds", () => {
  it("retient le pire des deux fonds", () => {
    const verdict = verifierSurFonds("#e9a824", FONDS_PAGE, CONTRASTE_MIN_LARGE);
    // Le doré se détache très bien du bleu nuit et mal du blanc : c'est le blanc
    // qui décide.
    expect(verdict.fondLePire).toBe("#ffffff");
    expect(verdict.ratio).toBeLessThan(ratioContraste("#e9a824", "#061e38"));
  });

  it("propose une teinte qui tient sur les deux fonds", () => {
    const suggestion = ajusterPourFonds("#e9a824", FONDS_PAGE, CONTRASTE_MIN_LARGE);
    expect(suggestion).not.toBeNull();
    expect(verifierSurFonds(suggestion!, FONDS_PAGE, CONTRASTE_MIN_LARGE).conforme).toBe(true);
  });

  it("renvoie null quand aucune teinte proche ne convient", () => {
    // Un gris moyen ne peut se détacher ni du blanc ni du bleu nuit : le
    // reconnaître vaut mieux que proposer une couleur qui échoue quand même.
    expect(ajusterPourFonds("#767676", FONDS_PAGE, 7)).toBeNull();
  });
});

describe("css du thème", () => {
  it("calcule le texte des boutons plutôt que de le demander", () => {
    const css = cssDuTheme({ ...THEME_PAR_DEFAUT, primaire: "#0b4f8a" });
    expect(css).toContain("--primary: #0b4f8a");
    expect(css).toContain(`--primary-text: ${BLANC}`);
  });

  it("n'impose pas de police quand le choix est « système »", () => {
    const css = cssDuTheme({ ...THEME_PAR_DEFAUT, police: "systeme" });
    expect(css).toContain("--font-body: system-ui");
  });

  it("référence la variable posée par next/font, jamais le nom de famille", () => {
    // Next génère un nom de famille haché à la compilation : écrire « Source
    // Sans 3 » en clair ne désignerait aucune police chargée.
    const css = cssDuTheme({ ...THEME_PAR_DEFAUT, police: "source-sans" });
    expect(css).toContain("var(--font-source-sans)");
    expect(css).not.toContain("'Source Sans 3'");
  });

  it("reporte le rayon choisi sur le jeton de carte", () => {
    expect(cssDuTheme({ ...THEME_PAR_DEFAUT, rayon: 4 })).toContain("--radius-card: 4px");
  });

  it("ne surcharge la couleur des titres que là où le thème clair s'applique", () => {
    /*
     * Le défaut fermé ici : `:root:not([data-theme="dark"])` n'excluait que le
     * thème sombre **choisi explicitement**. L'attribut étant absent par défaut,
     * un visiteur dont le système est en sombre recevait un titre bleu foncé sur
     * fond bleu nuit — 1,7:1, relevé par Lighthouse.
     */
    const css = cssDuTheme(THEME_PAR_DEFAUT);

    // Les deux situations où le clair s'applique réellement.
    expect(css).toContain(`:root[data-theme="light"]{--heading:`);
    expect(css).toContain(
      `@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--heading:`,
    );

    /*
     * Et nulle part ailleurs. On retire les deux blocs légitimes, puis on
     * vérifie qu'aucune déclaration de `--heading` ne subsiste : c'est la seule
     * formulation qui interdit la reprise du défaut sans interdire sa
     * correction, dont le sélecteur fautif reste un fragment.
     */
    const restant = css
      .replace(/:root\[data-theme="light"\]\{[^}]*\}/g, "")
      .replace(/@media \(prefers-color-scheme: light\)\{[^}]*\}\}/g, "");
    expect(restant).not.toContain("--heading:");
  });
});
