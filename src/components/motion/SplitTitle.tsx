import type { CSSProperties, ElementType } from "react";

/**
 * Titre qui arrive lettre par lettre (brief §4.1) : rotation X, flou, 28 ms
 * de décalage par lettre.
 *
 * Découpé **au rendu**, en JSX — pas en `innerHTML` après coup. Les mots sont
 * des blocs insécables : un mot ne se coupe jamais entre deux lignes. Le texte
 * complet est dans `aria-label`, les lettres en `aria-hidden` : un lecteur
 * d'écran lit le titre, pas une suite de lettres.
 *
 * Aucun JavaScript : l'animation est en CSS et n'existe que sous
 * `html[data-motion]` (constellation.css). Composant serveur.
 */
export function SplitTitle({
  texte,
  as: Balise = "h1",
  className = "",
  delaiInitial = 0.4,
}: {
  texte: string;
  as?: ElementType;
  className?: string;
  /** Départ de la première lettre, en secondes. */
  delaiInitial?: number;
}) {
  let rang = 0;
  const mots = texte.split(/\s+/).filter(Boolean);

  return (
    <Balise aria-label={texte} className={`titre-decoupe ${className}`}>
      {mots.map((mot, indexMot) => (
        <span key={indexMot}>
          <span aria-hidden className="titre-decoupe__mot">
            {[...mot].map((lettre, indexLettre) => {
              const style = {
                "--i": rang,
                "--d0": `${delaiInitial}s`,
              } as CSSProperties;
              rang += 1;
              return (
                <span key={indexLettre} className="titre-decoupe__lettre" style={style}>
                  {lettre}
                </span>
              );
            })}
          </span>
          {indexMot < mots.length - 1 ? " " : null}
        </span>
      ))}
    </Balise>
  );
}
