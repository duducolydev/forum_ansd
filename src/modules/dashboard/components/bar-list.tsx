import type { Breakdown } from "../service";

/**
 * Barres horizontales pour des catégories **nominales** (pays, catégorie,
 * institution) : une seule mesure, donc **une seule couleur** pour toutes les
 * barres. Les teinter du clair au foncé selon leur valeur doublerait
 * l'encodage — la longueur dit déjà la grandeur — et brûlerait le seul canal
 * libre pour rien.
 *
 * Horizontales et non verticales : les libellés sont longs (« Organisation
 * internationale », noms de pays) et se lisent sans rotation.
 */
export function BarList({
  data,
  emptyLabel = "Aucune donnée.",
}: {
  data: Breakdown[];
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="text-text-2 text-sm">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((row) => row.value), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3 xl:grid-cols-[minmax(0,12rem)_1fr_auto]"
        >
          <span className="text-text-2 truncate text-sm" title={row.label}>
            {row.label}
          </span>
          {/* Piste de fond : donne l'échelle sans ajouter de grille. */}
          <span className="bg-bg-3 block h-2.5 w-full rounded-[2px]">
            <span
              className="bg-chart-mark block h-2.5 rounded-r-[4px]"
              style={{ width: `${Math.max((row.value / max) * 100, 1.5)}%` }}
            />
          </span>
          <span className="text-heading w-10 text-right text-sm font-semibold tabular-nums">
            {row.value.toLocaleString("fr-FR")}
          </span>
        </li>
      ))}
    </ul>
  );
}
