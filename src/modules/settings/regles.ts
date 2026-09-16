import type { Inscriptions } from "./schema";

/**
 * Règles pures des paramètres : aucune base, aucun Prisma.
 *
 * Séparées du service pour deux raisons : elles se testent sans base, et le
 * calcul de contraste doit pouvoir tourner **dans le navigateur** pour montrer
 * le ratio à mesure qu'on choisit une couleur, avant même d'enregistrer.
 */

export type MotifFermeture = "OUVERTES" | "DESACTIVEES" | "PAS_ENCORE" | "TERMINEES";

export interface EtatInscriptions {
  ouvertes: boolean;
  motif: MotifFermeture;
  /** Jour d'ouverture à venir, pour l'annoncer plutôt que de laisser deviner. */
  ouvreLe: string | null;
}

/** Jour courant en UTC, qui est aussi le jour local à Dakar (UTC+0 toute l'année). */
export function jourDe(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * Les deux bornes sont **incluses** : fermer le 16 novembre laisse la journée
 * du 16 entière. Une borne haute exclusive fermerait le guichet la veille au
 * soir, ce que personne n'attend d'un champ intitulé « fermeture le ».
 */
export function etatInscriptions(
  inscriptions: Inscriptions,
  maintenant: Date = new Date(),
): EtatInscriptions {
  const aujourdhui = jourDe(maintenant);
  const ouvreLe = inscriptions.ouvertureLe || null;

  if (!inscriptions.active) {
    return { ouvertes: false, motif: "DESACTIVEES", ouvreLe: null };
  }
  if (ouvreLe && aujourdhui < ouvreLe) {
    return { ouvertes: false, motif: "PAS_ENCORE", ouvreLe };
  }
  if (inscriptions.fermetureLe && aujourdhui > inscriptions.fermetureLe) {
    return { ouvertes: false, motif: "TERMINEES", ouvreLe: null };
  }
  return { ouvertes: true, motif: "OUVERTES", ouvreLe: null };
}

// --- Contraste (WCAG 2.1) ---------------------------------------------------

/** Seuil AA pour le texte courant (brief §7 via l'audit T19). */
export const CONTRASTE_MIN = 4.5;

/** Seuil AA pour les grands textes et les éléments d'interface. */
export const CONTRASTE_MIN_LARGE = 3;

function canal(valeur: number): number {
  const proportion = valeur / 255;
  return proportion <= 0.03928 ? proportion / 12.92 : ((proportion + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const propre = hex.replace("#", "");
  const r = Number.parseInt(propre.slice(0, 2), 16);
  const v = Number.parseInt(propre.slice(2, 4), 16);
  const b = Number.parseInt(propre.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(v) + 0.0722 * canal(b);
}

/** Rapport de contraste entre deux couleurs, de 1 (identiques) à 21 (noir/blanc). */
export function ratioContraste(premiere: string, seconde: string): number {
  const a = luminance(premiere);
  const b = luminance(seconde);
  const clair = Math.max(a, b);
  const sombre = Math.min(a, b);
  return (clair + 0.05) / (sombre + 0.05);
}

export const BLANC = "#ffffff";
export const ENCRE = "#12212f";

/**
 * Texte à poser sur un fond : celui des deux qui contraste le mieux.
 *
 * Calculé et non choisi. C'est ce qui permet d'ouvrir les couleurs au
 * paramétrage sans reproduire le défaut trouvé en T34 — des boutons bleus à
 * 4,14:1 avec du texte blanc, sous le seuil, pendant des semaines.
 */
export function texteSur(fond: string): string {
  return ratioContraste(fond, BLANC) >= ratioContraste(fond, ENCRE) ? BLANC : ENCRE;
}

export interface VerdictContraste {
  couleur: string;
  texte: string;
  ratio: number;
  conforme: boolean;
}

export function verifierCouleur(fond: string, seuil = CONTRASTE_MIN): VerdictContraste {
  const texte = texteSur(fond);
  const ratio = ratioContraste(fond, texte);
  return { couleur: fond, texte, ratio, conforme: ratio >= seuil };
}

/** Arrondi d'affichage : « 7,01:1 » se lit, « 7.0128654:1 » non. */
export function formaterRatio(ratio: number): string {
  return `${ratio.toFixed(2).replace(".", ",")}:1`;
}

/** Fonds de page des deux thèmes, tels que définis dans `globals.css`. */
export const FOND_CLAIR = "#ffffff";
export const FOND_SOMBRE = "#061e38";
export const FONDS_PAGE = [FOND_CLAIR, FOND_SOMBRE] as const;

export interface VerdictSurFonds {
  /** Le pire des ratios : une couleur ne vaut que par son plus mauvais fond. */
  ratio: number;
  fondLePire: string;
  conforme: boolean;
}

/**
 * Contrôle d'une couleur qui doit **se détacher** d'un fond plutôt que porter
 * du texte — le contour de focus au clavier, notamment, qui relève du seuil
 * non-textuel de 3:1 (WCAG 1.4.11). Le site ayant deux thèmes, la couleur doit
 * tenir sur les deux : c'est le pire des deux qui décide.
 */
export function verifierSurFonds(
  couleur: string,
  fonds: readonly string[] = FONDS_PAGE,
  seuil = CONTRASTE_MIN_LARGE,
): VerdictSurFonds {
  let ratio = Number.POSITIVE_INFINITY;
  let fondLePire = fonds[0] ?? FOND_CLAIR;

  for (const fond of fonds) {
    const candidat = ratioContraste(couleur, fond);
    if (candidat < ratio) {
      ratio = candidat;
      fondLePire = fond;
    }
  }

  return { ratio, fondLePire, conforme: ratio >= seuil };
}

/**
 * Cherche, autour d'une couleur, la teinte la plus proche qui tienne sur tous
 * les fonds.
 *
 * Assombrir ne suffit pas ici : ce qui gagne du contraste sur le blanc en perd
 * sur le bleu nuit. La teinte recherchée vit dans une bande étroite, et il
 * arrive qu'il n'y en ait aucune — auquel cas on renvoie `null` plutôt que de
 * proposer une couleur qui ne respecte pas la consigne.
 */
export function ajusterPourFonds(
  couleur: string,
  fonds: readonly string[] = FONDS_PAGE,
  seuil = CONTRASTE_MIN_LARGE,
): string | null {
  const propre = couleur.replace("#", "");
  const base = [
    Number.parseInt(propre.slice(0, 2), 16),
    Number.parseInt(propre.slice(2, 4), 16),
    Number.parseInt(propre.slice(4, 6), 16),
  ];

  const enHex = (composantes: number[]) =>
    `#${composantes
      .map((c) =>
        Math.min(255, Math.max(0, Math.round(c)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;

  // On s'écarte par pas croissants, dans les deux sens, et on retient le
  // premier candidat conforme : c'est le plus proche de la couleur demandée.
  for (let pas = 0; pas <= 50; pas++) {
    const facteur = 1 - pas * 0.02;
    const versLeSombre = enHex(base.map((c) => c * facteur));
    if (verifierSurFonds(versLeSombre, fonds, seuil).conforme) return versLeSombre;

    const versLeClair = enHex(base.map((c) => c + (255 - c) * (pas * 0.02)));
    if (verifierSurFonds(versLeClair, fonds, seuil).conforme) return versLeClair;
  }
  return null;
}

/**
 * Assombrit une couleur jusqu'à ce qu'elle atteigne le seuil avec du blanc.
 *
 * Proposé à l'utilisateur plutôt qu'imposé : refuser une couleur sans montrer
 * la teinte la plus proche qui passe revient à dire « non » sans dire comment.
 */
export function assombrirJusquAuSeuil(hex: string, seuil = CONTRASTE_MIN): string {
  const propre = hex.replace("#", "");
  let composantes = [
    Number.parseInt(propre.slice(0, 2), 16),
    Number.parseInt(propre.slice(2, 4), 16),
    Number.parseInt(propre.slice(4, 6), 16),
  ];

  // Pas de 2 % par itération : 60 tours suffisent à atteindre le noir, dont le
  // ratio avec le blanc est de 21 — la boucle se termine toujours.
  for (let tour = 0; tour < 60; tour++) {
    const candidat = `#${composantes.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
    if (ratioContraste(candidat, BLANC) >= seuil) return candidat;
    composantes = composantes.map((c) => c * 0.94);
  }
  return "#000000";
}
