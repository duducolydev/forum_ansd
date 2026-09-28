import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Trois piliers (brief §4.2) : numéro 01 à 03 en contour, icône qui se dessine
 * trait par trait à l'apparition, entrée échelonnée.
 *
 * Titres et textes viennent de la section (BackOffice, FR/EN) ; les icônes
 * suivent le rang — produire (barres), partager (réseau), décider (validation).
 */

const ICONES: ReactNode[] = [
  <>
    <rect x="3" y="12" width="4" height="9" />
    <rect x="10" y="7" width="4" height="14" />
    <rect x="17" y="3" width="4" height="18" />
  </>,
  <>
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <line x1="8.6" y1="10.5" x2="15.4" y2="7.5" />
    <line x1="8.6" y1="13.5" x2="15.4" y2="16.5" />
  </>,
  <>
    <circle cx="12" cy="12" r="9" />
    <polyline points="8 12 11 15 16 9" />
  </>,
];

export function Piliers({ piliers }: { piliers: { titre: string; texte: string }[] }) {
  return (
    <div className="grid grid-cols-1 gap-[1.4rem] md:grid-cols-3">
      {piliers.map((pilier, rang) => (
        <Reveal key={rang} as="article" variant="up" delay={rang * 0.15} className="pilier">
          <span aria-hidden className="pilier__numero">
            {String(rang + 1).padStart(2, "0")}
          </span>
          <div className="pilier__icone">
            <svg aria-hidden viewBox="0 0 24 24" className="dessin">
              {ICONES[rang % ICONES.length]}
            </svg>
          </div>
          <h3 className="pilier__titre">{pilier.titre}</h3>
          <p className="pilier__texte">{pilier.texte}</p>
        </Reveal>
      ))}
    </div>
  );
}
