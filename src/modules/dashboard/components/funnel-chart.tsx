import type { FunnelStage } from "../service";

/**
 * Entonnoir : barres horizontales, pas une forme en trapèze.
 *
 * Le trapèze est décoratif — il encode la même grandeur deux fois (largeur ET
 * pente) et rend les petites étapes illisibles. Des barres partant d'une même
 * ligne de base se comparent honnêtement.
 *
 * Les étapes étant **ordonnées**, elles portent une rampe ordinale d'une seule
 * teinte, du clair au foncé — la couleur code la position dans la séquence, pas
 * la valeur. Rampe vérifiée avec le validateur de la charte (monotonie de
 * clarté, écart entre pas, contraste du pas le plus proche de la surface), pour
 * les deux thèmes séparément.
 */
const ORDINAL = [
  "var(--chart-ordinal-1)",
  "var(--chart-ordinal-2)",
  "var(--chart-ordinal-3)",
  "var(--chart-ordinal-4)",
  "var(--chart-ordinal-5)",
];

export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <ul className="flex flex-col gap-3">
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1]! : null;
        // Taux de passage d'une étape à la suivante : c'est là que se lit une
        // déperdition, pas dans la valeur absolue.
        const step =
          previous && previous.value > 0 ? Math.round((stage.value / previous.value) * 100) : null;

        return (
          <li key={stage.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-text-2 text-sm">{stage.label}</span>
              <span className="flex items-baseline gap-2">
                {step !== null && (
                  <span className="text-text-3 text-xs tabular-nums">{step} %</span>
                )}
                <span className="text-heading text-sm font-semibold tabular-nums">
                  {stage.value.toLocaleString("fr-FR")}
                </span>
              </span>
            </div>
            <span className="bg-bg-3 block h-3 w-full rounded-[2px]">
              <span
                className="block h-3 rounded-r-[4px]"
                style={{
                  width: `${Math.max((stage.value / max) * 100, 1.5)}%`,
                  backgroundColor: ORDINAL[Math.min(index, ORDINAL.length - 1)],
                }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
