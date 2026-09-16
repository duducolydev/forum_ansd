"use client";

import { useActionState } from "react";
import { ajouterSectionAction, type EtatAction } from "../actions";
import { CATALOGUE } from "../catalogue";
import { Plus } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const etatInitial: EtatAction = {};

export function AjoutSection({ page }: { page: string }) {
  const [etat, action, enCours] = useActionState(
    ajouterSectionAction.bind(null, page),
    etatInitial,
  );

  return (
    <form action={action} className="border-border bg-surface rounded-xl border p-5">
      <h3 className="text-heading mb-1 text-sm font-semibold">Ajouter une section</h3>
      <p className="text-text-3 mb-3 text-xs">
        Elle est ajoutée en fin de page et masquée : réglez-la, puis affichez-la.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <label htmlFor="type-section" className="text-text-3 text-xs font-semibold">
            Type
          </label>
          <select
            id="type-section"
            name="type"
            defaultValue={CATALOGUE[0]!.cle}
            className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm"
          >
            {CATALOGUE.map((type) => (
              <option key={type.cle} value={type.cle}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <Bouton ton="secondaire" icone={Plus} type="submit" disabled={enCours}>
          {enCours ? "Ajout…" : "Ajouter"}
        </Bouton>
      </div>
      {etat.erreur && <p className="text-danger-text mt-2 text-sm">{etat.erreur}</p>}
      {etat.avis && <p className="text-accent-text mt-2 text-sm">{etat.avis}</p>}
    </form>
  );
}
