"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { selon } from "@/lib/langue";
import { NOM_FOURNISSEUR, urlLecteur, vignetteFournisseur } from "@/modules/medias/video";

/**
 * Lecteur de la diffusion en direct.
 *
 * **Clic pour lancer**, et non chargement immédiat de l'`iframe`. Trois
 * raisons, dont une seule suffirait :
 *
 * - *Vie privée* : le domaine « sans cookie » ne dépose rien tant que la
 *   lecture n'a pas commencé. Charger l'`iframe` d'emblée ferait du simple
 *   affichage de la page un dépôt chez un tiers, sur une page qui n'a pas
 *   demandé le consentement.
 * - *Lecture automatique* : un navigateur la refuse avec le son, et la
 *   couper d'office pour contourner le refus servirait mal une page dont le
 *   son **est** le contenu.
 * - *Bande passante* : la page sera ouverte en fond toute la journée sur des
 *   postes de la salle. Elle ne doit pas tirer un flux vidéo que personne ne
 *   regarde.
 *
 * La vignette de la plateforme sert d'affiche : elle vient d'une adresse fixe,
 * déjà autorisée par le `img-src` du CSP.
 */
export function LecteurDirect({
  fournisseur,
  identifiant,
  titre,
  langue,
}: {
  fournisseur: string;
  identifiant: string;
  titre: string;
  langue: string;
}) {
  const [lance, setLance] = useState(false);
  const source = urlLecteur(fournisseur, identifiant);
  const affiche = vignetteFournisseur(fournisseur, identifiant);

  /*
   * Couple illisible : ni `urlLecteur` ni le rendu ne doivent improviser. Le
   * cas ne peut venir que d'une écriture faite hors du formulaire, mais la
   * page du direct ne doit pas tomber pour autant.
   */
  if (!source) return null;

  const lancer = selon(langue, {
    fr: "Lancer la diffusion",
    en: "Start the broadcast",
    pt: "Iniciar a transmissão",
  });

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
      {lance ? (
        <iframe
          src={source}
          title={titre}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLance(true)}
          className="group absolute inset-0 grid place-items-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
        >
          {affiche && (
            /* eslint-disable-next-line @next/next/no-img-element -- vignette de la plateforme, adresse fixe */
            <img
              src={affiche}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-70 transition-opacity group-hover:opacity-85"
            />
          )}
          <span className="relative flex flex-col items-center gap-3 text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
            <PlayCircle aria-hidden size={72} strokeWidth={1.6} />
            <span className="text-base font-semibold">{lancer}</span>
            <span className="text-xs text-white/75">
              {selon(langue, {
                fr: `Lecture par ${NOM_FOURNISSEUR[fournisseur as "youtube" | "vimeo"]} — aucun cookie n'est déposé avant.`,
                en: `Played by ${NOM_FOURNISSEUR[fournisseur as "youtube" | "vimeo"]} — no cookie is set before that.`,
                pt: `Reproduzido por ${NOM_FOURNISSEUR[fournisseur as "youtube" | "vimeo"]} — nenhum cookie é colocado antes.`,
              })}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
