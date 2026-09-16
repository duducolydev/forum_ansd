"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { enregistrerIdentiteAction, type EtatAction } from "../actions";
import { CHAMP, Champ, Panneau, Retour } from "./champs";

const etatInitial: EtatAction = {};

export interface ValeursIdentite {
  title: string;
  theme: string;
  startDate: string;
  endDate: string;
  venue: string;
  city: string;
}

export function FormulaireIdentite({ valeurs }: { valeurs: ValeursIdentite }) {
  const [etat, action, enCours] = useActionState(enregistrerIdentiteAction, etatInitial);

  return (
    <Panneau
      titre="Édition"
      description="Ce que le site public annonce partout : titre, thème, dates et lieu. Le compte à rebours de la page d'accueil suit la date de début."
    >
      <form action={action} className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Champ id="edition-title" label="Titre de l'édition">
          <input
            id="edition-title"
            name="title"
            required
            defaultValue={valeurs.title}
            className={CHAMP}
          />
        </Champ>
        <Champ id="edition-theme" label="Thème de l'édition">
          <input id="edition-theme" name="theme" defaultValue={valeurs.theme} className={CHAMP} />
        </Champ>
        <Champ id="edition-start" label="Premier jour">
          <input
            id="edition-start"
            name="startDate"
            type="date"
            required
            defaultValue={valeurs.startDate}
            className={CHAMP}
          />
        </Champ>
        <Champ id="edition-end" label="Dernier jour">
          <input
            id="edition-end"
            name="endDate"
            type="date"
            required
            defaultValue={valeurs.endDate}
            className={CHAMP}
          />
        </Champ>
        <Champ id="edition-venue" label="Lieu">
          <input
            id="edition-venue"
            name="venue"
            required
            defaultValue={valeurs.venue}
            className={CHAMP}
          />
        </Champ>
        <Champ id="edition-city" label="Ville">
          <input
            id="edition-city"
            name="city"
            required
            defaultValue={valeurs.city}
            className={CHAMP}
          />
        </Champ>

        <div className="md:col-span-2">
          <Bouton ton="principal" icone={Save} type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
          <Retour etat={etat} />
        </div>
      </form>
    </Panneau>
  );
}
