"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { enregistrerInscriptionsAction, type EtatAction } from "../actions";
import { etatInscriptions } from "../regles";
import type { Inscriptions } from "../schema";
import { CHAMP, Champ, Panneau, Retour } from "./champs";

const etatInitial: EtatAction = {};

const MOTIFS: Record<string, string> = {
  OUVERTES: "Les inscriptions sont ouvertes.",
  DESACTIVEES: "Fermées : l'interrupteur est sur « non ».",
  PAS_ENCORE: "Fermées : la date d'ouverture n'est pas atteinte.",
  TERMINEES: "Fermées : la date de fermeture est dépassée.",
};

export function FormulaireInscriptions({ valeurs }: { valeurs: Inscriptions }) {
  const [etat, action, enCours] = useActionState(enregistrerInscriptionsAction, etatInitial);

  // Aperçu vivant : le réglage se juge à son effet, pas à ses trois champs.
  const [brouillon, setBrouillon] = useState<Inscriptions>(valeurs);
  const apercu = etatInscriptions(brouillon);

  function majChamp<C extends keyof Inscriptions>(champ: C, valeur: Inscriptions[C]) {
    setBrouillon((precedent) => ({ ...precedent, [champ]: valeur }));
  }

  return (
    <Panneau
      titre="Inscriptions"
      description="Les deux bornes sont incluses : fermer au 16 novembre laisse la journée du 16 entière. Une invitation nominative reste valable hors de cette fenêtre, et le comptoir d'accueil n'est jamais bloqué."
    >
      <form action={action} className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-text-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={valeurs.active}
              onChange={(event) => majChamp("active", event.target.checked)}
            />
            Guichet ouvert (interrupteur immédiat, indépendant des dates)
          </label>
        </div>

        <Champ id="insc-ouverture" label="Ouverture le" aide="Vide : ouvert dès maintenant.">
          <input
            id="insc-ouverture"
            name="ouvertureLe"
            type="date"
            defaultValue={valeurs.ouvertureLe}
            onChange={(event) => majChamp("ouvertureLe", event.target.value)}
            className={CHAMP}
          />
        </Champ>
        <Champ id="insc-fermeture" label="Fermeture le" aide="Vide : pas de fermeture programmée.">
          <input
            id="insc-fermeture"
            name="fermetureLe"
            type="date"
            defaultValue={valeurs.fermetureLe}
            onChange={(event) => majChamp("fermetureLe", event.target.value)}
            className={CHAMP}
          />
        </Champ>

        <Champ id="insc-msg-fr" label="Message affiché quand c'est fermé (français)">
          <textarea
            id="insc-msg-fr"
            name="messageFermeFr"
            rows={2}
            defaultValue={valeurs.messageFermeFr}
            className={CHAMP}
          />
        </Champ>
        <Champ id="insc-msg-en" label="Message affiché quand c'est fermé (anglais)">
          <textarea
            id="insc-msg-en"
            name="messageFermeEn"
            rows={2}
            defaultValue={valeurs.messageFermeEn}
            className={CHAMP}
          />
        </Champ>

        <div className="md:col-span-2">
          <p
            className={`mb-3 rounded-lg px-3 py-2 text-sm ${
              apercu.ouvertes ? "bg-accent-soft text-accent-text" : "bg-warn-soft text-warn-text"
            }`}
          >
            État aujourd&apos;hui : {MOTIFS[apercu.motif]}
            {apercu.ouvreLe ? ` Ouverture prévue le ${apercu.ouvreLe}.` : ""}
          </p>
          <Bouton ton="principal" icone={Save} type="submit" disabled={enCours}>
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </Bouton>
          <Retour etat={etat} />
        </div>
      </form>
    </Panneau>
  );
}
