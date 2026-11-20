"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointAudience } from "../audience";

const HAUTEUR = 180;
const MARGE = { haut: 14, droite: 12, bas: 26, gauche: 36 };

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

/**
 * Courbe des spectateurs simultanés d'une journée, par créneau de cinq
 * minutes.
 *
 * Une aire et non des barres : trois cents créneaux feraient des barres d'un
 * pixel, illisibles. La largeur est mesurée côté client plutôt que confiée à
 * un `viewBox` étiré — `preserveAspectRatio="none"` déformerait l'épaisseur du
 * trait, comme pour la courbe des inscriptions.
 *
 * Les heures sont celles de Dakar, c'est-à-dire UTC : les relevés sont
 * horodatés en UTC et le fuseau du navigateur d'un lecteur à l'étranger ne
 * doit pas décaler la journée du Forum.
 */
export function CourbeAudience({ points }: { points: PointAudience[] }) {
  const cadre = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(640);
  const [survol, setSurvol] = useState<number | null>(null);

  useEffect(() => {
    const element = cadre.current;
    if (!element) return;
    const observateur = new ResizeObserver(([entree]) => {
      if (entree) setLargeur(Math.max(280, Math.round(entree.contentRect.width)));
    });
    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  const geometrie = useMemo(() => {
    const dedansL = largeur - MARGE.gauche - MARGE.droite;
    const dedansH = HAUTEUR - MARGE.haut - MARGE.bas;
    const maximum = Math.max(...points.map((point) => point.viewers), 1);
    const pas = palier(maximum);
    const plafond = Math.ceil(maximum / pas) * pas;

    const x = (rang: number) =>
      MARGE.gauche + (points.length <= 1 ? dedansL / 2 : (rang / (points.length - 1)) * dedansL);
    const y = (valeur: number) => MARGE.haut + dedansH - (valeur / plafond) * dedansH;

    const sommets = points.map((point, rang) => ({ ...point, cx: x(rang), cy: y(point.viewers) }));
    const trace = sommets.map((s, rang) => `${rang === 0 ? "M" : "L"}${s.cx} ${s.cy}`).join(" ");
    const aire =
      sommets.length > 0
        ? `${trace} L${sommets[sommets.length - 1]!.cx} ${MARGE.haut + dedansH} L${sommets[0]!.cx} ${MARGE.haut + dedansH} Z`
        : "";

    const graduations = [0, plafond / 2, plafond].map((valeur) => ({ valeur, y: y(valeur) }));
    return { sommets, trace, aire, graduations, basse: MARGE.haut + dedansH };
  }, [points, largeur]);

  if (points.length === 0) {
    return (
      <p className="text-text-3 py-8 text-center text-sm">
        Aucun spectateur relevé pour cette journée.
      </p>
    );
  }

  const actif = survol === null ? null : geometrie.sommets[survol];

  return (
    <div ref={cadre} className="relative w-full">
      <svg
        width={largeur}
        height={HAUTEUR}
        role="img"
        aria-label={`Spectateurs simultanés : pic de ${Math.max(...points.map((p) => p.viewers))}`}
        onMouseLeave={() => setSurvol(null)}
      >
        {geometrie.graduations.map((graduation) => (
          <g key={graduation.valeur}>
            <line
              x1={MARGE.gauche}
              x2={largeur - MARGE.droite}
              y1={graduation.y}
              y2={graduation.y}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={MARGE.gauche - 6}
              y={graduation.y + 3}
              textAnchor="end"
              className="fill-text-3 text-[10px]"
            >
              {Math.round(graduation.valeur)}
            </text>
          </g>
        ))}

        <path d={geometrie.aire} className="fill-accent-text/15" />
        <path
          d={geometrie.trace}
          fill="none"
          className="stroke-accent-text"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {actif && (
          <>
            <line
              x1={actif.cx}
              x2={actif.cx}
              y1={MARGE.haut}
              y2={geometrie.basse}
              className="stroke-text-3"
              strokeDasharray="3 3"
            />
            <circle cx={actif.cx} cy={actif.cy} r={4} className="fill-accent-text" />
          </>
        )}

        {/* Bandes de survol : une par point, pour que le pointeur n'ait pas à
            viser un trait de deux pixels. */}
        {geometrie.sommets.map((sommet, rang) => (
          <rect
            key={sommet.at}
            x={sommet.cx - (largeur - MARGE.gauche - MARGE.droite) / (points.length * 2 || 1)}
            y={MARGE.haut}
            width={Math.max(2, (largeur - MARGE.gauche - MARGE.droite) / (points.length || 1))}
            height={geometrie.basse - MARGE.haut}
            fill="transparent"
            onMouseEnter={() => setSurvol(rang)}
          />
        ))}

        <text x={MARGE.gauche} y={HAUTEUR - 8} className="fill-text-3 text-[10px]">
          {HEURE.format(new Date(points[0]!.at))}
        </text>
        <text
          x={largeur - MARGE.droite}
          y={HAUTEUR - 8}
          textAnchor="end"
          className="fill-text-3 text-[10px]"
        >
          {HEURE.format(new Date(points[points.length - 1]!.at))}
        </text>
      </svg>

      {actif && (
        <p className="text-text-2 mt-1 text-xs">
          <strong className="text-heading">{actif.viewers}</strong> lecteur
          {actif.viewers > 1 ? "s" : ""} à {HEURE.format(new Date(actif.at))}
        </p>
      )}
    </div>
  );
}

/** Graduation ronde : 1, 2, 5, 10, 20, 50… selon l'ordre de grandeur. */
function palier(maximum: number): number {
  const ordre = 10 ** Math.floor(Math.log10(Math.max(maximum, 1)));
  for (const facteur of [1, 2, 5]) {
    if (maximum / (ordre * facteur) <= 2) return ordre * facteur;
  }
  return ordre * 10;
}
