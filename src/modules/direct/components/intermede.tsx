"use client";

import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { localeIntl, selon } from "@/lib/langue";
import type { CreneauDirect } from "@/modules/settings/regles";
import type { Direct, MessageDirect } from "@/modules/settings/schema";
import { FondDirect } from "./fond-direct";

/** Décompte « MM:SS », ou « H:MM:SS » au-delà de l'heure. */
function decompte(millisecondes: number): string {
  const total = Math.max(0, Math.floor(millisecondes / 1000));
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secondes = total % 60;
  const deuxChiffres = (valeur: number) => String(valeur).padStart(2, "0");
  return heures > 0
    ? `${heures}:${deuxChiffres(minutes)}:${deuxChiffres(secondes)}`
    : `${deuxChiffres(minutes)}:${deuxChiffres(secondes)}`;
}

/**
 * Écran d'attente du direct : pauses, transitions, avant l'ouverture.
 *
 * Ce qu'il doit faire, dans l'ordre : dire que **tout va bien** — un écran noir
 * passe pour une panne, et le public qui suit de loin n'a aucun moyen de
 * vérifier —, dire **quand ça reprend**, et faire passer le temps.
 *
 * Le décompte est le cœur de l'écran, pas l'animation : c'est la seule chose
 * que le téléspectateur est venu chercher quand il tombe sur une pause. Il
 * n'apparaît que si le programme publié annonce une séance suivante ; sans
 * horaire connu, mieux vaut ne rien promettre.
 *
 * **Lecture d'écran** : un message qui change toutes les neuf secondes et des
 * secondes qui défilent seraient insupportables à l'oreille. Le carrousel et
 * le compteur sont donc `aria-hidden`, et les mêmes informations sont données
 * une fois, en texte stable, pour les lecteurs d'écran — l'horaire de reprise
 * plutôt que le temps restant.
 */
export function Intermede({
  messages,
  fond,
  secondesParMessage,
  suivant,
  termine,
  langue,
  onRevelerFlux,
}: {
  messages: MessageDirect[];
  fond: Direct["fond"];
  secondesParMessage: number;
  suivant: CreneauDirect | null;
  termine: boolean;
  langue: string;
  /** Affiché seulement si une diffusion est réglée : voir `EcranDirect`. */
  onRevelerFlux?: () => void;
}) {
  const [rang, setRang] = useState(0);
  const [restant, setRestant] = useState<number | null>(null);

  /* Rotation des messages. Un seul minuteur, relancé si la durée change. */
  useEffect(() => {
    if (messages.length < 2) return;
    const minuteur = setInterval(
      () => setRang((precedent) => (precedent + 1) % messages.length),
      Math.max(4, secondesParMessage) * 1000,
    );
    return () => clearInterval(minuteur);
  }, [messages.length, secondesParMessage]);

  /*
   * Décompte. Recalculé depuis l'horloge à chaque seconde plutôt que
   * décrémenté : un onglet en arrière-plan voit ses minuteurs ralentis par le
   * navigateur, et un compteur décrémenté y prendrait du retard sans jamais
   * le rattraper.
   */
  useEffect(() => {
    if (!suivant) {
      setRestant(null);
      return;
    }
    const cible = Date.parse(suivant.debut);
    const mesurer = () => setRestant(cible - Date.now());
    mesurer();
    const minuteur = setInterval(mesurer, 1000);
    return () => clearInterval(minuteur);
  }, [suivant]);

  const message = messages[rang % Math.max(1, messages.length)] ?? null;
  const texte = message ? selon(langue, message) : "";

  /* UTC et non l'horloge du visiteur : les horaires annoncés sont ceux de
     Dakar, et c'est à eux que le public se réfère, où qu'il se trouve. */
  const heureReprise = suivant
    ? new Intl.DateTimeFormat(localeIntl(langue), {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(new Date(suivant.debut))
    : null;

  const etiquette = termine
    ? selon(langue, {
        fr: "Diffusion terminée",
        en: "Broadcast ended",
        pt: "Transmissão terminada",
      })
    : selon(langue, { fr: "En attente", en: "Standing by", pt: "Em espera" });

  return (
    <div className="relative isolate aspect-video w-full overflow-hidden rounded-xl bg-[#0b2340] text-white">
      {/* Couche décorative, sous le contenu et sans interaction possible. */}
      <div className="absolute inset-0 isolate overflow-hidden" aria-hidden>
        <FondDirect fond={fond} />
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-5 px-6 text-center sm:px-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[0.7rem] font-bold tracking-[0.14em] text-white/90 uppercase backdrop-blur-sm">
          <span className="direct-pouls h-2 w-2 rounded-full bg-[#e8b931]" aria-hidden />
          {etiquette}
        </span>

        {texte && (
          <p
            key={rang}
            aria-hidden
            className="direct-message max-w-[28ch] text-2xl font-semibold text-balance drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:max-w-[34ch] sm:text-4xl"
          >
            {texte}
          </p>
        )}

        {restant !== null && restant > 0 && (
          <div className="rounded-xl bg-black/35 px-5 py-3 backdrop-blur-sm">
            <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-white/75 uppercase">
              {selon(langue, { fr: "Reprise dans", en: "Back in", pt: "Regresso em" })}
            </p>
            {/* Chiffres tabulaires : les secondes qui défilent ne font pas
                danser la ligne, sans avoir à lui fixer une largeur. */}
            <p aria-hidden className="text-3xl font-bold tabular-nums sm:text-5xl">
              {decompte(restant)}
            </p>
            {suivant && <p className="mt-1 max-w-[36ch] text-sm text-white/80">{suivant.titre}</p>}
          </div>
        )}

        {onRevelerFlux && (
          /*
           * La salle coupe rarement la caméra pendant une pause : le flux peut
           * très bien continuer alors que le programme dit « intermède ». Ce
           * bouton rend la main au téléspectateur sans retirer l'écran
           * d'attente à ceux que l'image d'une salle vide n'intéresse pas.
           */
          <button
            type="button"
            onClick={onRevelerFlux}
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <PlayCircle aria-hidden size={18} strokeWidth={2.2} />
            {selon(langue, {
              fr: "Voir le flux quand même",
              en: "Show the stream anyway",
              pt: "Ver a transmissão mesmo assim",
            })}
          </button>
        )}

        {/* Version stable, pour les lecteurs d'écran : ni carrousel ni secondes. */}
        <div className="sr-only">
          <p>{etiquette}</p>
          {heureReprise && suivant && (
            <p>
              {selon(langue, {
                fr: `Reprise prévue à ${heureReprise} : ${suivant.titre}`,
                en: `Resuming at ${heureReprise}: ${suivant.titre}`,
                pt: `Regresso previsto às ${heureReprise}: ${suivant.titre}`,
              })}
            </p>
          )}
          <ul>
            {messages.map((autre, index) => (
              <li key={index}>{selon(langue, autre)}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
