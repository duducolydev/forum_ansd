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
/** Un sigle entre parenthèses, en fin de libellé : « … Démographie (ANSD) ». */
const SIGLE_FINAL = /\s*\(([^()]{2,12})\)\s*$/;

/**
 * Le sigle devant, le nom derrière.
 *
 * La colonne des libellés coupe **par la fin** : huit rem, douze en très large
 * écran, `truncate` par-dessus. « Agence Nationale de la Statistique et de la
 * Démographie » et « Agence Nationale de l'Aviation Civile … » s'affichaient
 * donc l'une comme l'autre « Agence Nationale … » — deux lignes indistinctes
 * dans un graphique dont le seul objet est de les comparer (18 novembre 2026).
 *
 * Ajouter le sigle au nom enregistré ne suffisait pas : placé à la fin, il
 * tombait exactement dans la partie coupée. Le remonter en tête met la seule
 * information distinctive là où la troncature ne l'atteint jamais — sans
 * compter de caractères ni deviner une largeur de police, ce qui serait faux à
 * l'un des deux points de rupture. Le nom complet reste au survol.
 *
 * Les libellés sans parenthèse finale — pays, catégories, la plupart des
 * institutions — passent intacts.
 */
export function libelleAbrege(libelle: string): string {
  const trouve = SIGLE_FINAL.exec(libelle);
  if (!trouve) return libelle;
  const nom = libelle.slice(0, trouve.index).trim();
  return nom ? `${trouve[1]} — ${nom}` : libelle;
}

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
            {libelleAbrege(row.label)}
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
