"use client";

import { useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { lireLangue, selon } from "@/lib/langue";
import { extraitBiographie } from "@/lib/biographie";
import { libellePays } from "@/lib/pays";
import { FenetreIntervenant, type ProfilIntervenant } from "./fenetre-intervenant";

/**
 * Carte d'un intervenant sur la fiche d'un panel (5 novembre 2026).
 *
 * Toute la carte ouvre la fiche détaillée, et un bouton « Voir le profil » le
 * dit — biographie ou non : sans biographie longue, la carte n'offrait rien à
 * cliquer. Le bouton porte l'accès au clavier ; le clic sur le reste de la
 * carte n'est qu'une commodité de souris, d'où l'absence de rôle sur elle.
 */
export function CarteIntervenantSession({
  profil,
  role,
  langue: langueBrute,
}: {
  profil: ProfilIntervenant;
  /** Rôle dans cette session, déjà traduit. */
  role: string;
  langue: string;
}) {
  const langue = lireLangue(langueBrute);
  const [ouverte, setOuverte] = useState(false);
  const bio = profil.bio?.trim();
  const details = [profil.fonction, profil.organisation].filter(Boolean).join(" · ");
  // Enregistré en français, montré dans la langue de la page.
  const pays = profil.pays ? libellePays(profil.pays, langue) : "";

  return (
    <div
      onClick={() => setOuverte(true)}
      className="border-border bg-surface carte-relief hover:border-link/40 flex h-full cursor-pointer flex-col rounded-xl border p-5 transition-colors"
    >
      {/*
       * Portrait en grand, avec l'anneau des cartes de /intervenants : c'est le
       * visage qu'on vient chercher sur la fiche d'un panel.
       */}
      <div className="text-center">
        <div className="avatar-anneau">
          <span className="avatar-anneau__contenu">
            {profil.photoUrl ? (
              <Image
                src={profil.photoUrl}
                alt=""
                fill
                sizes="118px"
                unoptimized
                className="object-cover"
              />
            ) : (
              <span aria-hidden>{profil.initiales}</span>
            )}
          </span>
        </div>
        <p className="text-accent-text text-xs font-semibold tracking-wide uppercase">{role}</p>
        <p className="text-heading mt-0.5 text-lg leading-snug font-semibold">{profil.nom}</p>
      </div>
      {details && <p className="text-text-3 mt-2 text-center text-sm leading-relaxed">{details}</p>}
      {/* Extrait seulement : une biographie de 600 mots allongerait la carte. */}
      {bio && (
        <p className="text-text-2 mt-3 text-sm leading-relaxed">
          {extraitBiographie(bio, 280).extrait}
        </p>
      )}
      <div className="mt-auto flex flex-col items-center gap-2.5 pt-4">
        {/*
         * Le pays, bien visible juste avant le bouton (6 novembre 2026) : il se
         * perdait en fin de ligne, après la fonction et l'organisation.
         */}
        {pays && (
          <p className="police-grotesk text-center text-sm font-bold tracking-[0.14em] text-(--green-text) uppercase">
            {pays}
          </p>
        )}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={selon(langue, {
            fr: `Voir le profil de ${profil.nom}`,
            en: `View ${profil.nom}'s profile`,
            pt: `Ver o perfil de ${profil.nom}`,
          })}
          onClick={(evenement) => {
            evenement.stopPropagation();
            setOuverte(true);
          }}
          className="text-link hover:text-secondary-hover border-border hover:border-link/40 inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors"
        >
          <UserRound aria-hidden size={15} />
          {selon(langue, { fr: "Voir le profil", en: "View profile", pt: "Ver o perfil" })}
        </button>
      </div>

      <FenetreIntervenant
        profil={{ ...profil, roles: [role] }}
        ouverte={ouverte}
        onFermer={() => setOuverte(false)}
        langue={langueBrute}
      />
    </div>
  );
}
