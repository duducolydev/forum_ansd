"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DailyPoint } from "../service";

const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 40 };

/**
 * Courbe des inscriptions par jour. Série **unique** : pas de légende — le
 * titre de la carte dit déjà ce qui est tracé, et une boîte à une pastille ne
 * ferait que le répéter.
 *
 * La largeur est mesurée côté client plutôt que déléguée à un `viewBox`
 * étiré : un `preserveAspectRatio="none"` déformerait les marqueurs et
 * l'épaisseur du trait.
 */
export function RegistrationsChart({ data }: { data: DailyPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(320, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    const innerWidth = width - PADDING.left - PADDING.right;
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
    const maxValue = Math.max(...data.map((point) => point.value), 1);
    // Graduations arrondies : l'axe porte les valeurs qu'on ne libelle pas.
    const step = niceStep(maxValue);
    const top = Math.ceil(maxValue / step) * step;

    const x = (index: number) =>
      PADDING.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
    const y = (value: number) => PADDING.top + innerHeight - (value / top) * innerHeight;

    const points = data.map((point, index) => ({ ...point, cx: x(index), cy: y(point.value) }));
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.cx},${p.cy}`).join(" ");
    const area =
      points.length > 0
        ? `${line} L${points[points.length - 1]!.cx},${PADDING.top + innerHeight} L${points[0]!.cx},${PADDING.top + innerHeight} Z`
        : "";

    const ticks: { value: number; y: number }[] = [];
    for (let value = 0; value <= top; value += step) ticks.push({ value, y: y(value) });

    return { points, line, area, ticks, innerWidth, innerHeight, top };
  }, [data, width]);

  if (data.length === 0) {
    return (
      <p className="text-text-2 text-sm">
        Aucune inscription enregistrée pour l&apos;instant : la courbe apparaîtra dès la première.
      </p>
    );
  }

  const active = hover !== null ? geometry.points[hover] : null;
  const last = geometry.points[geometry.points.length - 1]!;

  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} className="relative w-full">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Inscriptions par jour, du ${formatDay(data[0]!.day)} au ${formatDay(last.day)}`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const cursor = event.clientX - rect.left;
            let nearest = 0;
            for (let i = 1; i < geometry.points.length; i++) {
              if (
                Math.abs(geometry.points[i]!.cx - cursor) <
                Math.abs(geometry.points[nearest]!.cx - cursor)
              ) {
                nearest = i;
              }
            }
            setHover(nearest);
          }}
        >
          {/* Grille : filets pleins d'un pas au-dessus de la surface, jamais en
              pointillés — le pointillé se lit comme un seuil. */}
          {geometry.ticks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-[var(--text-3)] text-[10px] tabular-nums"
              >
                {tick.value.toLocaleString("fr-FR")}
              </text>
            </g>
          ))}

          <path d={geometry.area} fill="var(--chart-mark)" opacity={0.1} />
          <path
            d={geometry.line}
            fill="none"
            stroke="var(--chart-mark)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {active && (
            <line
              x1={active.cx}
              x2={active.cx}
              y1={PADDING.top}
              y2={PADDING.top + geometry.innerHeight}
              stroke="var(--chart-mark)"
              strokeWidth={1}
              opacity={0.5}
            />
          )}

          {/* Point d'extrémité libellé, et point survolé : on ne pose pas une
              valeur sur chaque point — un nombre partout ne se lit plus. */}
          {[last, ...(active && active !== last ? [active] : [])].map((point) => (
            <circle
              key={point.day}
              cx={point.cx}
              cy={point.cy}
              r={4}
              fill="var(--chart-mark)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}

          <text
            x={Math.min(last.cx + 8, width - PADDING.right)}
            y={Math.max(last.cy - 8, PADDING.top + 8)}
            textAnchor={last.cx > width - 60 ? "end" : "start"}
            className="fill-[var(--heading)] text-[11px] font-semibold tabular-nums"
          >
            {last.value.toLocaleString("fr-FR")}
          </text>

          <text
            x={PADDING.left}
            y={HEIGHT - 8}
            className="fill-[var(--text-3)] text-[10px]"
            textAnchor="start"
          >
            {formatDay(data[0]!.day)}
          </text>
          {data.length > 1 && (
            <text
              x={width - PADDING.right}
              y={HEIGHT - 8}
              className="fill-[var(--text-3)] text-[10px]"
              textAnchor="end"
            >
              {formatDay(last.day)}
            </text>
          )}
        </svg>

        {active && (
          <div
            className="border-border bg-surface text-text pointer-events-none absolute z-10 rounded-lg border px-2.5 py-1.5 text-xs shadow-md"
            style={{
              left: Math.min(Math.max(active.cx - 60, 0), Math.max(width - 130, 0)),
              top: Math.max(active.cy - 52, 0),
            }}
          >
            <div className="text-text-3">{formatDay(active.day)}</div>
            <div className="text-heading font-semibold tabular-nums">
              {active.value.toLocaleString("fr-FR")} inscription(s)
            </div>
          </div>
        )}
      </div>

      {/* Vue tableau : l'information ne doit jamais dépendre de la seule lecture
          du graphique (lecteur d'écran, impression, daltonisme). */}
      <details className="text-sm">
        <summary className="text-text-3 cursor-pointer">Voir les données</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-text-3">
            <tr>
              <th className="py-1 font-medium">Jour</th>
              <th className="py-1 font-medium">Inscriptions</th>
            </tr>
          </thead>
          <tbody className="text-text-2">
            {data.map((point) => (
              <tr key={point.day}>
                <td className="py-1">{formatDay(point.day)}</td>
                <td className="py-1 tabular-nums">{point.value.toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function niceStep(max: number): number {
  const rough = Math.max(1, max / 4);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const factor of [1, 2, 5, 10]) {
    if (rough <= factor * magnitude) return factor * magnitude;
  }
  return 10 * magnitude;
}

function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}
