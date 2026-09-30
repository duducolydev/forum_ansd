"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { enregistrerLanguesAction, type EtatAction } from "../actions";
import type { Langues } from "../schema";
import { Panneau, Retour } from "./champs";

const etatInitial: EtatAction = {};

/** Langues proposées aux visiteurs : le portugais s'active ici. */
export function FormulaireLangues({ valeurs }: { valeurs: Langues }) {
  const [etat, action, enCours] = useActionState(enregistrerLanguesAction, etatInitial);

  return (
    <Panneau
      titre="Langues du site"
      description="Le français et l'anglais sont toujours proposés. Le portugais peut être préparé avant d'être ouvert : chaque contenu du BackOffice a un champ portugais ; vide, c'est la version anglaise qui s'affiche."
    >
      <form action={action} className="flex flex-col gap-3">
        <label className="text-text-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="portugais" defaultChecked={valeurs.portugais} />
          Proposer le portugais aux visiteurs (bouton « PT » du sélecteur de langue)
        </label>
        <div>
          <Bouton ton="principal" icone={Save} type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
          <Retour etat={etat} />
        </div>
      </form>
    </Panneau>
  );
}
