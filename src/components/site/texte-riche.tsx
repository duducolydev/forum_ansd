import { Fragment, type ReactNode } from "react";
import {
  lireTexteRiche,
  type BlocRiche,
  type EnLigneRiche,
  type MarqueRiche,
} from "@/lib/texte-riche";

/**
 * Affichage d'un texte mis en forme (PLAN.md §17).
 *
 * Aucun HTML n'est injecté : chaque nœud permis devient un élément React, et le
 * texte passe par React, qui l'échappe. Un `<script>` tapé dans l'éditeur
 * s'affiche comme les huit caractères qu'il est.
 *
 * Composant sans état ni effet : il se rend côté serveur, et la page publique
 * n'embarque rien de l'éditeur.
 */

const CLASSE_LIEN = "text-link font-semibold underline underline-offset-2";

function avecMarques(
  contenu: ReactNode,
  marques: MarqueRiche[] | undefined,
  cle: string,
  classeLien: string,
): ReactNode {
  // La première marque enveloppe les suivantes : un lien reste le plus extérieur.
  return [...(marques ?? [])].reverse().reduce<ReactNode>((interieur, marque, rang) => {
    const k = `${cle}-m${rang}`;
    switch (marque.type) {
      case "bold":
        return <strong key={k}>{interieur}</strong>;
      case "italic":
        return <em key={k}>{interieur}</em>;
      case "underline":
        return <u key={k}>{interieur}</u>;
      case "link": {
        const externe = /^https?:\/\//i.test(marque.attrs.href);
        return (
          <a
            key={k}
            href={marque.attrs.href}
            className={classeLien}
            {...(externe ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {interieur}
          </a>
        );
      }
    }
  }, contenu);
}

function enLigne(noeuds: EnLigneRiche[] | undefined, cle: string, classeLien: string): ReactNode[] {
  return (noeuds ?? []).map((noeud, rang) => {
    const k = `${cle}-${rang}`;
    return noeud.type === "hardBreak" ? (
      <br key={k} />
    ) : (
      <Fragment key={k}>{avecMarques(noeud.text, noeud.marks, k, classeLien)}</Fragment>
    );
  });
}

function blocs(noeuds: BlocRiche[], cle: string, classeLien: string): ReactNode[] {
  return noeuds.map((bloc, rang) => {
    const k = `${cle}-${rang}`;
    if (bloc.type === "paragraph") return <p key={k}>{enLigne(bloc.content, k, classeLien)}</p>;

    const elements = bloc.content.map((element, rangElement) => (
      <li key={`${k}-${rangElement}`}>
        {blocs(element.content, `${k}-${rangElement}`, classeLien)}
      </li>
    ));
    return bloc.type === "orderedList" ? (
      <ol key={k} className="list-decimal ps-6">
        {elements}
      </ol>
    ) : (
      <ul key={k} className="list-disc ps-6">
        {elements}
      </ul>
    );
  });
}

/**
 * Espacements portés par le conteneur : un paragraphe du texte n'a pas à
 * connaître ses voisins, et le texte brut ancien, lu en paragraphes, retrouve la
 * respiration que lui donnaient ses lignes vides.
 */
const RYTHME = "[&>*+*]:mt-4 [&_li+li]:mt-1.5 [&_li>ol]:mt-1.5 [&_li>ul]:mt-1.5";

export function TexteRiche({
  valeur,
  className = "",
  classeLien = CLASSE_LIEN,
}: {
  valeur: string;
  className?: string;
  /**
   * Couleur des liens. Par défaut, celle du thème ; sur un panneau toujours
   * sombre posé dans une page claire (l'appel à l'action), le lien du thème
   * clair serait illisible, d'où ce réglage.
   */
  classeLien?: string;
}) {
  const doc = lireTexteRiche(valeur);
  if (doc.content.length === 0) return null;
  return <div className={`${RYTHME} ${className}`}>{blocs(doc.content, "b", classeLien)}</div>;
}
