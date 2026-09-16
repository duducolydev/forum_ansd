"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { enregistrerPiedDePageAction, type EtatAction } from "../actions";
import { RESEAUX_LABELS, type PiedDePage, type Reseau } from "../schema";
import { CHAMP, Champ, Panneau, Retour } from "./champs";

const etatInitial: EtatAction = {};
const MAX_LIENS = 12;

export function FormulairePiedDePage({ valeurs }: { valeurs: PiedDePage }) {
  const [etat, action, enCours] = useActionState(enregistrerPiedDePageAction, etatInitial);

  // Une ligne vide de plus, toujours : ajouter un lien ne doit pas demander de
  // chercher un bouton.
  const [liens, setLiens] = useState([...valeurs.liens, { libelle: "", url: "" }]);

  const parReseau = new Map(valeurs.reseaux.map((entree) => [entree.reseau, entree.url]));

  function majLien(index: number, champ: "libelle" | "url", valeur: string) {
    setLiens((precedents) => {
      const copie = precedents.map((lien, position) =>
        position === index ? { ...lien, [champ]: valeur } : lien,
      );
      const dernier = copie[copie.length - 1];
      if (dernier && (dernier.libelle || dernier.url) && copie.length < MAX_LIENS) {
        copie.push({ libelle: "", url: "" });
      }
      return copie;
    });
  }

  return (
    <Panneau
      titre="Pied de page"
      description="Coordonnées, réseaux et liens affichés au bas de chaque page publique. Un réseau sans adresse n'apparaît pas : vider le champ suffit à le retirer."
    >
      <form action={action} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <Champ id="pied-organisation" label="Organisation">
            <input
              id="pied-organisation"
              name="organisation"
              defaultValue={valeurs.organisation}
              className={CHAMP}
            />
          </Champ>
          <Champ id="pied-copyright" label="Mention de bas de page">
            <input
              id="pied-copyright"
              name="mentionCopyright"
              defaultValue={valeurs.mentionCopyright}
              className={CHAMP}
            />
          </Champ>
          <Champ id="pied-adresse" label="Adresse postale">
            <input
              id="pied-adresse"
              name="adresse"
              defaultValue={valeurs.adresse}
              className={CHAMP}
            />
          </Champ>
          <div className="grid grid-cols-2 gap-3.5">
            <Champ id="pied-email" label="Courriel de contact">
              <input
                id="pied-email"
                name="email"
                type="email"
                defaultValue={valeurs.email}
                className={CHAMP}
              />
            </Champ>
            <Champ id="pied-tel" label="Téléphone">
              <input
                id="pied-tel"
                name="telephone"
                defaultValue={valeurs.telephone}
                className={CHAMP}
              />
            </Champ>
          </div>
        </div>

        <fieldset className="border-border border-t pt-4">
          <legend className="text-text-3 mb-2 text-xs font-semibold">Réseaux sociaux</legend>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {(Object.keys(RESEAUX_LABELS) as Reseau[]).map((reseau) => (
              <Champ key={reseau} id={`reseau-${reseau}`} label={RESEAUX_LABELS[reseau]}>
                <input
                  id={`reseau-${reseau}`}
                  name={`reseau-${reseau}`}
                  placeholder="https://…"
                  defaultValue={parReseau.get(reseau) ?? ""}
                  className={CHAMP}
                />
              </Champ>
            ))}
          </div>
        </fieldset>

        <fieldset className="border-border border-t pt-4">
          <legend className="text-text-3 mb-2 text-xs font-semibold">
            Liens supplémentaires — vider les deux champs retire la ligne
          </legend>
          <div className="flex flex-col gap-2">
            {liens.map((lien, index) => (
              <div key={index} className="flex gap-2">
                <input
                  name={`lien-libelle-${index}`}
                  value={lien.libelle}
                  onChange={(event) => majLien(index, "libelle", event.target.value)}
                  placeholder="Libellé"
                  aria-label={`Libellé du lien ${index + 1}`}
                  className={`${CHAMP} w-1/3`}
                />
                <input
                  name={`lien-url-${index}`}
                  value={lien.url}
                  onChange={(event) => majLien(index, "url", event.target.value)}
                  placeholder="/infos-pratiques ou https://…"
                  aria-label={`Adresse du lien ${index + 1}`}
                  className={`${CHAMP} flex-1`}
                />
              </div>
            ))}
          </div>
        </fieldset>

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
