"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";

/**
 * Carrousel qui défile en continu (partenaires de l'accueil, §32).
 *
 * Les éléments arrivent rendus côté serveur ; ce composant ne fait que les
 * poser deux fois sur une piste animée en CSS (`.defilement-*`, globals.css) et
 * porter le bouton Pause. La seconde copie est `inert` et `aria-hidden` : ni la
 * tabulation ni un lecteur d'écran ne la parcourent, la liste n'est lue qu'une
 * fois.
 *
 * La durée croît avec le nombre d'éléments, pour garder la même vitesse
 * apparente quelle que soit la longueur de la liste.
 */
export function Defilement({
  elements,
  nombre,
  libelle,
  en,
}: {
  elements: ReactNode;
  nombre: number;
  /** Nom de la liste, annoncé par les lecteurs d'écran. */
  libelle: string;
  en: boolean;
}) {
  const [pause, setPause] = useState(false);
  const style = { "--duree-defilement": `${Math.max(24, nombre * 5)}s` } as CSSProperties;

  return (
    <div className="defilement" data-pause={pause ? "" : undefined}>
      <div className="defilement-fenetre py-3">
        <div className="defilement-piste" style={style}>
          <ul aria-label={libelle} className="flex shrink-0 gap-5 pr-5">
            {elements}
          </ul>
          <ul aria-hidden inert className="defilement-copie flex shrink-0 gap-5 pr-5">
            {elements}
          </ul>
        </div>
      </div>

      <div className="defilement-commande mt-3 flex justify-end">
        <button
          type="button"
          // Le libellé change avec l'état : un `aria-pressed` en plus ferait
          // annoncer « Reprendre, activé », qui se contredit.
          onClick={() => setPause((valeur) => !valeur)}
          className="text-text-2 hover:text-heading hover:bg-surface transition-tout inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
        >
          {pause ? <Play aria-hidden size={13} /> : <Pause aria-hidden size={13} />}
          {pause
            ? en
              ? "Resume scrolling"
              : "Reprendre le défilement"
            : en
              ? "Pause scrolling"
              : "Mettre en pause"}
        </button>
      </div>
    </div>
  );
}
