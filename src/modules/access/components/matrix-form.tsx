"use client";

import { useActionState, useRef } from "react";
import { saveMatrixAction, type ActionState } from "../actions";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

export interface MatrixCategory {
  id: string;
  code: string;
  labelFr: string;
  alertOnScan: boolean;
}

export interface MatrixZone {
  id: string;
  code: string;
  name: string;
}

/**
 * Matrice `Catégorie × Zone` (brief §2.6).
 *
 * Les cases sont **non contrôlées** (`defaultChecked`, aucun état React) : le
 * navigateur reste seul propriétaire de ce qui est coché, et le formulaire
 * envoie ce que l'écran affiche. Les boutons « toute la ligne » agissent
 * directement sur le DOM pour la même raison. Un état React ici nous a déjà
 * coûté cher au formulaire d'inscription, où React sérialisait sa propre vue
 * plutôt que celle de l'utilisateur.
 */
export function MatrixForm({
  categories,
  zones,
  allowed,
}: {
  categories: MatrixCategory[];
  zones: MatrixZone[];
  allowed: string[];
}) {
  const [state, formAction, pending] = useActionState(saveMatrixAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const coche = new Set(allowed);

  function basculerLigne(categoryId: string, valeur: boolean) {
    const cases = formRef.current?.querySelectorAll<HTMLInputElement>(
      `input[data-categorie="${categoryId}"]`,
    );
    cases?.forEach((element) => {
      element.checked = valeur;
    });
  }

  if (zones.length === 0) {
    return (
      <p className="text-text-3 text-sm">
        Aucune zone définie : commencez par en créer une ci-dessous.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Zones ouvertes à chaque catégorie de participant. Cochez pour autoriser.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="text-text-3 px-2 py-2 text-left text-xs font-semibold">
                Catégorie
              </th>
              {zones.map((zone) => (
                <th
                  key={zone.id}
                  scope="col"
                  className="text-text-3 px-2 py-2 text-center text-xs font-semibold"
                  title={zone.name}
                >
                  {zone.code}
                </th>
              ))}
              <th
                scope="col"
                className="text-accent-text border-border border-l px-2 py-2 text-center text-xs font-semibold"
                title="Scan orange : l'agent est invité à accueillir la personne"
              >
                À accueillir
              </th>
              <th scope="col" className="px-2 py-2 text-right text-xs">
                <span className="sr-only">Sélection par ligne</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((categorie) => (
              <tr key={categorie.id} className="border-border border-t">
                <th scope="row" className="text-heading px-2 py-2 text-left font-medium">
                  {categorie.labelFr}
                </th>
                {zones.map((zone) => {
                  const cle = `${categorie.id}:${zone.id}`;
                  return (
                    <td key={zone.id} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        name="cell"
                        value={cle}
                        data-categorie={categorie.id}
                        defaultChecked={coche.has(cle)}
                        aria-label={`${categorie.labelFr} — ${zone.name}`}
                        className="accent-primary h-4 w-4"
                      />
                    </td>
                  );
                })}
                <td className="border-border border-l px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    name="alert"
                    value={categorie.id}
                    defaultChecked={categorie.alertOnScan}
                    aria-label={`${categorie.labelFr} — signaler à l'accueil`}
                    className="accent-accent h-4 w-4"
                  />
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => basculerLigne(categorie.id, true)}
                    className="text-link text-xs font-semibold"
                  >
                    tout
                  </button>
                  <span className="text-text-3 mx-1 text-xs">/</span>
                  <button
                    type="button"
                    onClick={() => basculerLigne(categorie.id, false)}
                    className="text-link text-xs font-semibold"
                  >
                    rien
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Bouton ton="principal" icone={Save} type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer la matrice"}
        </Bouton>
        {state.error && <p className="text-danger-text text-sm">{state.error}</p>}
        {state.message && !state.error && <p className="text-text-3 text-sm">{state.message}</p>}
      </div>
    </form>
  );
}
