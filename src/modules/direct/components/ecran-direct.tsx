"use client";

import { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { selon } from "@/lib/langue";
import { etatDirect, type CreneauDirect, type ModeDirect } from "@/modules/settings/regles";
import type { Direct, MessageDirect } from "@/modules/settings/schema";
import { Intermede } from "./intermede";
import { LecteurDirect } from "./lecteur-direct";

/** Une seconde suffirait, dix suffisent : la bascule n'est pas à la seconde près. */
const PERIODE_MS = 10_000;

/**
 * Écran du direct : décide à chaque instant entre le lecteur et l'attente.
 *
 * **Pourquoi côté client.** L'état dépend de l'heure qu'il est. Calculé une
 * fois au rendu, il figerait la page : un téléspectateur arrivé pendant la
 * pause resterait devant l'écran d'attente après la reprise, jusqu'à ce qu'il
 * pense à recharger. La règle est donc réévaluée toutes les dix secondes,
 * avec la même fonction pure que le BackOffice (`settings/regles.ts`) — un
 * seul endroit décide, et il est testé.
 *
 * **Hydratation.** Le serveur rend l'état tel qu'il est à l'envoi, et le
 * premier rendu du client repart du *même* instant : sans cela, deux horloges
 * à quelques secondes d'écart produiraient deux HTML différents de part et
 * d'autre d'une frontière de session. Le minuteur ne prend la main qu'ensuite.
 *
 * **Le lecteur se démonte pendant l'attente**, et c'est assumé : le laisser
 * monté derrière l'écran d'attente ferait continuer le son d'une salle vide
 * par-dessus les messages. Le bouton « Voir le flux quand même » rend la main
 * à qui veut, et ce choix tient ensuite pour toute la visite — l'avoir demandé
 * une fois suffit.
 */
export function EcranDirect({
  video,
  mode,
  margeMinutes,
  creneaux,
  messages,
  fond,
  secondesParMessage,
  instantServeur,
  langue,
}: {
  video: Direct["video"];
  mode: ModeDirect;
  margeMinutes: number;
  creneaux: CreneauDirect[];
  messages: MessageDirect[];
  fond: Direct["fond"];
  secondesParMessage: number;
  /** Horloge du serveur au rendu, ISO : point de départ commun aux deux côtés. */
  instantServeur: string;
  langue: string;
}) {
  const [maintenant, setMaintenant] = useState<number>(() => Date.parse(instantServeur));
  const [fluxForce, setFluxForce] = useState(false);

  useEffect(() => {
    setMaintenant(Date.now());
    const minuteur = setInterval(() => setMaintenant(Date.now()), PERIODE_MS);
    return () => clearInterval(minuteur);
  }, []);

  const etat = useMemo(
    () => etatDirect(mode, margeMinutes, creneaux, new Date(maintenant)),
    [mode, margeMinutes, creneaux, maintenant],
  );

  const montrerLecteur = Boolean(video) && (etat.antenne || fluxForce);

  return (
    <div className="flex flex-col gap-4">
      {montrerLecteur && video ? (
        <LecteurDirect
          fournisseur={video.fournisseur}
          identifiant={video.identifiant}
          titre={
            etat.courant?.titre ??
            selon(langue, {
              fr: "Diffusion en direct du Forum",
              en: "Forum live broadcast",
              pt: "Transmissão em direto do Fórum",
            })
          }
          langue={langue}
        />
      ) : (
        <Intermede
          messages={messages}
          fond={fond}
          secondesParMessage={secondesParMessage}
          suivant={etat.suivant}
          termine={etat.termine}
          langue={langue}
          onRevelerFlux={video ? () => setFluxForce(true) : undefined}
        />
      )}

      {/* Bandeau d'orientation : ce qui passe, ce qui suit. */}
      <div className="border-border bg-surface flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-4 py-3 text-sm">
        {etat.antenne && etat.courant ? (
          <span className="flex min-w-0 items-center gap-2">
            <Radio aria-hidden size={16} className="text-accent-text shrink-0" />
            <span className="text-text-3">
              {selon(langue, { fr: "En ce moment", en: "On now", pt: "Neste momento" })}
            </span>
            <strong className="text-heading truncate">{etat.courant.titre}</strong>
          </span>
        ) : null}

        {etat.suivant ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-text-3">
              {selon(langue, { fr: "À suivre", en: "Up next", pt: "A seguir" })}
            </span>
            <strong className="text-heading truncate">{etat.suivant.titre}</strong>
          </span>
        ) : etat.termine ? (
          <span className="text-text-3">
            {selon(langue, {
              fr: "Dernière session diffusée. Les rediffusions rejoindront la médiathèque.",
              en: "Final session broadcast. Replays will join the media library.",
              pt: "Última sessão transmitida. As repetições juntar-se-ão à mediateca.",
            })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
