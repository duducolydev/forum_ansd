import { POLICES, type ThemeEdition } from "./schema";
import { texteSur } from "./regles";

/**
 * Traduit les réglages d'apparence en variables CSS.
 *
 * Fonction pure : elle se teste sans navigateur, et c'est elle qui décide des
 * couleurs dérivées — survol, texte posé sur un fond — plutôt que de les
 * demander à l'utilisateur. Un survol choisi à la main finit clair sur clair.
 */

/** Assombrit une couleur d'un facteur donné, pour les états de survol. */
function assombrir(hex: string, facteur: number): string {
  const propre = hex.replace("#", "");
  const composantes = [
    Number.parseInt(propre.slice(0, 2), 16),
    Number.parseInt(propre.slice(2, 4), 16),
    Number.parseInt(propre.slice(4, 6), 16),
  ];
  return `#${composantes
    .map((c) =>
      Math.round(c * facteur)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function pilePolice(cle: string): string | null {
  return POLICES.find((candidate) => candidate.cle === cle)?.pile ?? null;
}

/**
 * Variables surchargées par l'édition.
 *
 * Volontairement restreint : ce sont les jetons dont `globals.css` fait déjà
 * dériver le reste. Surcharger davantage reviendrait à réécrire la feuille de
 * style depuis la base de données, et à perdre les garanties de contraste
 * calculées pour les jetons voisins (texte atténué, fonds adoucis).
 */
export function cssDuTheme(theme: ThemeEdition): string {
  const pile = pilePolice(theme.police);

  const regles = [
    `--primary: ${theme.primaire}`,
    `--primary-hover: ${assombrir(theme.primaire, 0.82)}`,
    `--primary-text: ${texteSur(theme.primaire)}`,
    `--secondary: ${theme.secondaire}`,
    `--secondary-hover: ${assombrir(theme.secondaire, 0.82)}`,
    `--link: ${theme.secondaire}`,
    `--btn-blue: ${theme.secondaire}`,
    `--btn-blue-text: ${texteSur(theme.secondaire)}`,
    `--ansd-or: ${theme.accent}`,
    `--radius-card: ${theme.rayon}px`,
  ];

  if (pile) regles.push(`--font-body: ${pile}`);

  /*
   * `--heading` n'est surchargé qu'en thème **clair** : en thème sombre, les
   * titres sont proches du blanc, et leur donner la couleur des liens les rend
   * illisibles sur le fond bleu nuit.
   *
   * La première écriture disait `:root:not([data-theme="dark"])`, ce qui
   * n'excluait que le thème sombre **choisi explicitement**. Or l'attribut est
   * absent par défaut : tout visiteur dont le système est en sombre et qui n'a
   * jamais touché l'interrupteur — le cas le plus courant — recevait un titre
   * bleu foncé sur fond bleu nuit, à 1,7:1. Défaut relevé par l'audit
   * Lighthouse, qui tourne précisément dans ce mode.
   *
   * Il faut donc les deux cas où le clair s'applique réellement : le choix
   * explicite, et l'absence de choix sur un système clair.
   */
  const enClair = `--heading: ${theme.secondaire}`;

  return [
    `:root{${regles.join(";")}}`,
    `:root[data-theme="light"]{${enClair}}`,
    `@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){${enClair}}}`,
    theme.animation === "aucune" ? `:root{--duree-animation: 0ms}` : "",
  ]
    .filter(Boolean)
    .join("");
}
