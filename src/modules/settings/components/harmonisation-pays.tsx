"use client";

import { useActionState } from "react";
import { Check, Globe2 } from "lucide-react";
import { BoutonEnvoiConfirme } from "@/components/ui/bouton-confirme";
import { ChampPays } from "@/components/ui/champ-pays";
import { harmoniserPaysAction, type EtatAction } from "../actions";
import type { ValeurPays } from "../pays-service";

const etatInitial: EtatAction = {};

const LIBELLES: Record<keyof ValeurPays["parTable"], [string, string]> = {
  participants: ["participant", "participants"],
  intervenants: ["intervenant", "intervenants"],
  invitations: ["invitation", "invitations"],
  delegations: ["délégation", "délégations"],
};

/** « 12 participants · 1 intervenant » : où se trouve la valeur. */
function repartition(parTable: ValeurPays["parTable"]): string {
  return (Object.keys(LIBELLES) as (keyof typeof LIBELLES)[])
    .filter((table) => parTable[table] > 0)
    .map((table) => {
      const [un, plusieurs] = LIBELLES[table];
      return `${parTable[table]} ${parTable[table] > 1 ? plusieurs : un}`;
    })
    .join(" · ");
}

/**
 * Tableau d'harmonisation des pays (Paramètres › Pays).
 *
 * Une ligne par valeur exacte trouvée en base. Le pays reconnu est proposé et
 * la ligne cochée ; une valeur non reconnue attend qu'on choisisse son pays.
 * Rien n'est modifié avant le clic, confirmé, sur « Harmoniser ».
 */
export function HarmonisationPays({ valeurs }: { valeurs: ValeurPays[] }) {
  const [etat, action, enCours] = useActionState(harmoniserPaysAction, etatInitial);

  if (valeurs.length === 0) {
    return (
      <p className="bg-accent-soft text-accent-text flex items-center gap-2 rounded-xl p-4 text-sm font-semibold">
        <Check aria-hidden size={16} />
        Tous les pays enregistrés sont conformes à la liste.
        {etat.avis && <span className="font-normal">{etat.avis}</span>}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="border-border bg-surface overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="text-text-3 text-xs">
            <tr>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                Valeur en base
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                Fiches concernées
              </th>
              <th scope="col" className="w-72 px-3 py-2.5 text-left font-semibold">
                Pays à retenir
              </th>
              <th scope="col" className="px-3 py-2.5 text-center font-semibold">
                Appliquer
              </th>
            </tr>
          </thead>
          <tbody>
            {valeurs.map((ligne, rang) => (
              <tr
                key={ligne.valeur}
                data-testid="ligne-pays"
                className="border-border border-t align-middle"
              >
                <td className="px-3 py-2.5">
                  <input type="hidden" name={`de_${rang}`} value={ligne.valeur} />
                  {/* Entre guillemets : une espace en trop doit se voir. */}
                  <span className="text-heading font-mono">« {ligne.valeur} »</span>
                  {!ligne.proposition && (
                    <span className="text-gold-text block text-xs font-semibold">
                      Non reconnue : choisissez le pays
                    </span>
                  )}
                </td>
                <td className="text-text-2 px-3 py-2.5">
                  <span className="text-heading font-semibold">{ligne.total}</span>
                  <span className="text-text-3 block text-xs">{repartition(ligne.parTable)}</span>
                </td>
                <td className="px-3 py-2.5">
                  <ChampPays
                    name={`vers_${rang}`}
                    id={`vers_${rang}`}
                    defaultValue={ligne.proposition}
                    className="py-2 text-sm"
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    name={`appliquer_${rang}`}
                    defaultChecked={Boolean(ligne.proposition)}
                    aria-label={`Harmoniser « ${ligne.valeur} »`}
                    className="accent-primary h-4 w-4"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <BoutonEnvoiConfirme
          ton="principal"
          icone={Globe2}
          disabled={enCours}
          confirmation={{
            titre: "Harmoniser les pays cochés ?",
            texte:
              "Chaque valeur cochée sera remplacée par le pays retenu, sur toutes les fiches qui la portent (participants, intervenants, invitations, délégations).",
            confirmer: "Harmoniser",
          }}
        >
          {enCours ? "Harmonisation…" : "Harmoniser les valeurs cochées"}
        </BoutonEnvoiConfirme>
        {etat.erreur && (
          <p role="alert" className="text-danger-text text-sm">
            {etat.erreur}
          </p>
        )}
        {etat.avis && (
          <p role="status" className="text-accent-text text-sm">
            {etat.avis}
          </p>
        )}
      </div>
    </form>
  );
}
