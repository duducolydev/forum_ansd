import type { EntreeAudit } from "../service";

const FORMAT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "UTC",
});

function Details({ titre, valeur }: { titre: string; valeur: unknown }) {
  if (valeur === null || valeur === undefined) return null;
  return (
    <div className="min-w-[160px] flex-1">
      <span className="text-text-3 text-[0.7rem] font-semibold uppercase">{titre}</span>
      <pre className="bg-bg-2 text-text-2 mt-1 overflow-x-auto rounded-lg p-2 text-[0.72rem] whitespace-pre-wrap">
        {JSON.stringify(valeur, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Une ligne par écriture sensible, la plus récente en tête.
 *
 * Le détail avant/après est replié : on consulte ce journal pour retrouver
 * *quand* quelque chose est arrivé, et seulement ensuite *quoi*. Tout déplier
 * rendrait la page illisible dès la centaine de lignes.
 */
export function TableAudit({ entrees }: { entrees: EntreeAudit[] }) {
  if (entrees.length === 0) {
    return (
      <p className="border-border bg-surface text-text-3 rounded-xl border p-6 text-sm">
        Aucune entrée ne correspond à ces filtres.
      </p>
    );
  }

  return (
    <div
      data-testid="journal"
      className="border-border bg-surface overflow-hidden rounded-xl border"
    >
      {entrees.map((entree) => {
        const aDesDetails = entree.before !== null || entree.after !== null;
        const resume = (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-text-3 font-mono text-xs whitespace-nowrap">
              {FORMAT.format(entree.createdAt)}
            </span>
            <span className="text-heading text-sm font-semibold">{entree.action}</span>
            <span className="text-text-2 text-xs">
              {entree.entity} · {entree.entityId}
            </span>
            <span className="flex-1" />
            <span className="text-text-3 text-xs">{entree.acteur}</span>
          </div>
        );

        return (
          <div key={entree.id} className="border-border border-b px-4 py-3 last:border-b-0">
            {aDesDetails ? (
              <details>
                <summary className="cursor-pointer list-none">{resume}</summary>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Details titre="Avant" valeur={entree.before} />
                  <Details titre="Après" valeur={entree.after} />
                </div>
                {entree.ip && (
                  <p className="text-text-3 mt-2 text-[0.72rem]">
                    Adresse IP {entree.ip}
                    {entree.userAgent ? ` · ${entree.userAgent}` : ""}
                  </p>
                )}
              </details>
            ) : (
              resume
            )}
          </div>
        );
      })}
    </div>
  );
}
