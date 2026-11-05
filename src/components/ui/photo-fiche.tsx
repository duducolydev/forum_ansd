"use client";

import { useState } from "react";

/**
 * Photo d'une personne en tête de sa fiche du BackOffice (participant ou
 * intervenant).
 *
 * Un clic l'ouvre en grand dans un nouvel onglet, pour vérifier un visage ou
 * un cadrage. Si la route ne la sert pas — fichier absent du stockage, droit
 * manquant —, les initiales prennent sa place plutôt qu'une image cassée.
 */
export function PhotoFiche({
  src,
  initiales,
  legende,
}: {
  /** URL de la route qui sert la photo ; `null` sans photo. */
  src: string | null;
  initiales: string;
  /** Précision affichée sous la photo (par ex. sa provenance). */
  legende?: string;
}) {
  const [echec, setEchec] = useState(false);
  const visible = src !== null && !echec;

  return (
    <figure className="flex shrink-0 flex-col items-center gap-1">
      {visible ? (
        <a
          href={src}
          target="_blank"
          rel="noopener"
          title="Ouvrir la photo en grand"
          className="focus-visible:outline-accent rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- servie par une route dédiée, hors optimiseur */}
          <img
            src={src}
            alt="Photo"
            onError={() => setEchec(true)}
            className="border-border h-20 w-20 rounded-full border object-cover"
          />
        </a>
      ) : (
        <span
          aria-label="Pas de photo"
          className="border-border bg-bg text-text-3 grid h-20 w-20 place-items-center rounded-full border text-xl font-semibold"
        >
          {initiales}
        </span>
      )}
      {visible && legende && (
        <figcaption className="text-text-3 max-w-28 text-center text-[11px] leading-tight">
          {legende}
        </figcaption>
      )}
    </figure>
  );
}
