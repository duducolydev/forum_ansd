"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { enregistrerDirectAction, type EtatAction } from "../actions";
import { FONDS_DIRECT, MODES_DIRECT, type Direct } from "../schema";
import { Champ, CHAMP, Panneau, Retour } from "./champs";

const etatInitial: EtatAction = {};

/** Une langue de messages : une ligne par message, l'ordre apparie les trois. */
function ZoneMessages({
  nom,
  label,
  aide,
  valeur,
}: {
  nom: string;
  label: string;
  aide?: string;
  valeur: string;
}) {
  return (
    <Champ id={nom} label={label} aide={aide}>
      <textarea
        id={nom}
        name={nom}
        rows={5}
        defaultValue={valeur}
        className={`${CHAMP} font-mono text-xs leading-relaxed`}
      />
    </Champ>
  );
}

/**
 * Réglages de la diffusion en direct (19 novembre 2026).
 *
 * Un écran à part plutôt qu'un panneau de plus sous « Paramètres » : pendant
 * les trois jours, c'est le seul qu'on ouvrira, et on l'ouvrira en urgence.
 * Il ne doit pas falloir faire défiler le thème et le pied de page pour
 * atteindre l'interrupteur d'antenne.
 */
export function FormulaireDirect({ valeurs, lien }: { valeurs: Direct; lien: string }) {
  const [etat, action, enCours] = useActionState(enregistrerDirectAction, etatInitial);
  const [mode, setMode] = useState(valeurs.mode);

  const colonne = (langue: "fr" | "en" | "pt") =>
    valeurs.messages.map((message) => message[langue]).join("\n");

  return (
    <form action={action} className="flex flex-col gap-4">
      <Panneau
        titre="Diffusion"
        description="La page publique /direct intègre le lecteur de la plateforme. Rien n'est hébergé ici : le portail n'a ni la bande passante ni le transcodage d'un service vidéo."
      >
        <div className="flex flex-col gap-4">
          <label className="text-text-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="actif" defaultChecked={valeurs.actif} />
            Publier la page « En direct » et l&apos;ajouter au menu du site
          </label>

          <Champ
            id="lien"
            label="Adresse de la diffusion"
            aide="Collez l'adresse YouTube de la diffusion en cours (youtube.com/live/…, youtu.be/… ou watch?v=…), ou une adresse Vimeo. Après une coupure, YouTube crée une nouvelle diffusion : revenez coller la nouvelle adresse ici. Champ vide : la page reste publiée et affiche l'écran d'attente."
          >
            <input
              id="lien"
              name="lien"
              type="url"
              inputMode="url"
              defaultValue={lien}
              placeholder="https://www.youtube.com/live/…"
              className={CHAMP}
            />
          </Champ>

          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              id="mode"
              label="Antenne"
              aide="En automatique, le lecteur s'affiche pendant les créneaux des sessions publiées et l'écran d'attente le reste du temps. Les deux autres choix reprennent la main quand la journée ne suit plus le programme."
            >
              <select
                id="mode"
                name="mode"
                defaultValue={valeurs.mode}
                onChange={(evenement) =>
                  setMode(evenement.target.value as (typeof MODES_DIRECT)[number]["cle"])
                }
                className={CHAMP}
              >
                {MODES_DIRECT.map((choix) => (
                  <option key={choix.cle} value={choix.cle}>
                    {choix.label}
                  </option>
                ))}
              </select>
            </Champ>

            <Champ
              id="margeMinutes"
              label="Battement autour des horaires (minutes)"
              aide={
                mode === "auto"
                  ? "Une séance commence rarement à la minute prévue. Le lecteur apparaît ce nombre de minutes avant l'horaire annoncé et reste autant après la fin."
                  : "Sans effet tant que l'antenne est forcée."
              }
            >
              <input
                id="margeMinutes"
                name="margeMinutes"
                type="number"
                min={0}
                max={60}
                defaultValue={valeurs.margeMinutes}
                className={CHAMP}
              />
            </Champ>
          </div>
        </div>
      </Panneau>

      <Panneau
        titre="Écran d'attente"
        description="Ce que voient les téléspectateurs entre deux sessions, pendant les pauses et avant l'ouverture. Un écran noir laisse croire à une panne : l'attente s'annonce, avec le décompte jusqu'à la séance suivante."
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              id="fond"
              label="Animation de fond"
              aide="Décor animé derrière les messages. Il s'arrête de lui-même sous « mouvement réduit », quand l'onglet passe en arrière-plan, et si les animations du site sont désactivées."
            >
              <select id="fond" name="fond" defaultValue={valeurs.fond} className={CHAMP}>
                {FONDS_DIRECT.map((choix) => (
                  <option key={choix.cle} value={choix.cle}>
                    {choix.label}
                  </option>
                ))}
              </select>
            </Champ>

            <Champ
              id="secondesParMessage"
              label="Durée d'un message (secondes)"
              aide="Temps d'affichage avant de passer au suivant."
            >
              <input
                id="secondesParMessage"
                name="secondesParMessage"
                type="number"
                min={4}
                max={60}
                defaultValue={valeurs.secondesParMessage}
                className={CHAMP}
              />
            </Champ>
          </div>

          <p className="text-text-3 text-xs">
            Un message par ligne, douze au plus. C&apos;est l&apos;ordre des lignes qui apparie les
            traductions : la troisième ligne française s&apos;affiche avec la troisième ligne
            anglaise. Une langue laissée plus courte retombe sur le français.
          </p>

          <div className="grid gap-4 lg:grid-cols-3">
            <ZoneMessages nom="messagesFr" label="Messages — français" valeur={colonne("fr")} />
            <ZoneMessages nom="messagesEn" label="Messages — anglais" valeur={colonne("en")} />
            <ZoneMessages nom="messagesPt" label="Messages — portugais" valeur={colonne("pt")} />
          </div>
        </div>
      </Panneau>

      <div>
        <Bouton ton="principal" icone={Save} type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Bouton>
        <Retour etat={etat} />
      </div>
    </form>
  );
}
