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

/**
 * Alignement d'une image dans la colonne.
 *
 * Des marges automatiques plutôt qu'un `float` : le texte ne s'enroule pas
 * autour de l'image, et c'est voulu. Sur téléphone, où la colonne fait quelques
 * centaines de pixels, un habillage réduit le texte à deux mots par ligne.
 */
const ALIGNEMENT: Record<string, string> = {
  gauche: "me-auto",
  centre: "mx-auto",
  droite: "ms-auto",
};

function blocs(
  noeuds: BlocRiche[],
  cle: string,
  classeLien: string,
  urlImage?: (cle: number) => string | null,
): ReactNode[] {
  return noeuds.map((bloc, rang) => {
    const k = `${cle}-${rang}`;
    if (bloc.type === "paragraph") return <p key={k}>{enLigne(bloc.content, k, classeLien)}</p>;

    if (bloc.type === "image") {
      /*
       * Sans résolveur, l'image n'est pas rendue : le rang ne désigne rien
       * hors de l'objet qui porte la liste. Le reste du texte s'affiche quand
       * même — un document ne doit pas disparaître parce qu'une illustration
       * manque.
       */
      const src = urlImage?.(bloc.attrs.cle);
      if (!src) return null;
      return (
        /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée, dimensions variables */
        <img
          key={k}
          src={src}
          alt={bloc.attrs.alt}
          style={{ width: `${bloc.attrs.largeur}%` }}
          className={`block h-auto rounded-lg ${ALIGNEMENT[bloc.attrs.alignement] ?? "mx-auto"}`}
        />
      );
    }

    const elements = bloc.content.map((element, rangElement) => (
      <li key={`${k}-${rangElement}`}>
        {blocs(element.content, `${k}-${rangElement}`, classeLien, urlImage)}
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
  urlImage,
}: {
  valeur: string;
  className?: string;
  /**
   * Résout le rang d'une image en URL. Seules les newsletters en fournissent
   * un : ailleurs, le document ne contient pas de nœud image, et en accepter
   * un obligerait chaque page du site à savoir où puiser.
   */
  urlImage?: (cle: number) => string | null;
  /**
   * Couleur des liens. Par défaut, celle du thème ; sur un panneau toujours
   * sombre posé dans une page claire (l'appel à l'action), le lien du thème
   * clair serait illisible, d'où ce réglage.
   */
  classeLien?: string;
}) {
  const doc = lireTexteRiche(valeur, { images: Boolean(urlImage) });
  if (doc.content.length === 0) return null;
  return (
    <div className={`${RYTHME} ${className}`}>{blocs(doc.content, "b", classeLien, urlImage)}</div>
  );
}
