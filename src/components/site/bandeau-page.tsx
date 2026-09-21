import type { ReactNode } from "react";

/**
 * Bandeau d'ouverture d'une page intérieure (§10).
 *
 * Toutes les pages du site s'ouvraient sur un titre nu posé sur le fond blanc,
 * chacune avec sa propre largeur et son propre espacement. Le bandeau donne au
 * portail un seuil constant : même fond dégradé, même respiration, même
 * position du titre d'une page à l'autre.
 *
 * La largeur est un choix éditorial, pas décoratif : une page de texte suivi
 * (mentions légales, article) se lit à 720–900 px, une grille de cartes occupe
 * les 1200 px de la maquette. Le bandeau doit reprendre celle du contenu qu'il
 * annonce, sinon le titre flotte au-dessus d'une colonne décalée.
 *
 * **Hauteur ramenée au strict nécessaire** (PLAN.md §19) : 243 px sur écran de
 * bureau, mesurés, pour un sur-titre, un titre et une phrase — le contenu de la
 * page commençait sous la ligne de flottaison des écrans portables. Le `py` est
 * réduit, et le titre (`.bandeau-page h1`), le sur-titre et la phrase se
 * resserrent : `EnteteSection bandeau` et les pages à bandeau composé le font
 * chacune de leur côté.
 */
export const LARGEURS = {
  large: "max-w-[1200px]",
  moyen: "max-w-[900px]",
  etroit: "max-w-[720px]",
} as const;

export type LargeurPage = keyof typeof LARGEURS;

export function BandeauPage({
  largeur = "large",
  children,
}: {
  largeur?: LargeurPage;
  children: ReactNode;
}) {
  return (
    <section className="fond-bandeau bandeau-page border-border border-b py-5">
      <div className={`mx-auto px-6 ${LARGEURS[largeur]}`}>{children}</div>
    </section>
  );
}

/**
 * Colonne de contenu, alignée sur la largeur du bandeau qui la précède.
 *
 * Le rythme vertical est un choix parmi trois, et non une classe libre : passer
 * `py-16` par `className` laissait deux utilitaires de padding se disputer la
 * règle, et c'est l'ordre de la feuille de style — pas celui de l'attribut —
 * qui tranchait. Un menu fermé évite silencieusement ce piège.
 */
const ESPACEMENTS = {
  /** Contenu qui doit remonter au plus près du bandeau : le formulaire d'inscription. */
  serre: "py-6",
  compact: "py-12",
  normal: "py-14",
  ample: "py-16",
} as const;

export function CorpsPage({
  largeur = "large",
  espacement = "normal",
  className = "",
  children,
}: {
  largeur?: LargeurPage;
  espacement?: keyof typeof ESPACEMENTS;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`mx-auto px-6 ${LARGEURS[largeur]} ${ESPACEMENTS[espacement]} ${className}`}
    >
      {children}
    </section>
  );
}
