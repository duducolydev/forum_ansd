"use client";

import { useRef } from "react";
import { mouvementReduit, useReveal } from "./hooks";

const SIGNES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@";

/**
 * Étiquette qui se « décode » lettre par lettre à son apparition (brief §4.4).
 *
 * Le texte juste est rendu par le serveur ; seul un double visuel est brouillé
 * puis révélé. Les lecteurs d'écran lisent le texte, jamais les signes
 * aléatoires. Sous mouvement réduit, rien ne bouge (`useReveal` marque
 * l'élément vu d'emblée et le rappel n'anime pas).
 */
export function ScrambleText({ texte, className = "" }: { texte: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useReveal(ref, (element) => {
    if (mouvementReduit()) return;
    const visuel = element.querySelector<HTMLSpanElement>("[data-visuel]");
    if (!visuel) return;
    const lettres = [...texte];
    const total = lettres.length * 2.2;
    let image = 0;
    function pas() {
      visuel!.textContent = lettres
        .map((lettre, rang) =>
          lettre === " " || rang < image / 2.2
            ? lettre
            : SIGNES[Math.floor(Math.random() * SIGNES.length)],
        )
        .join("");
      image += 1;
      if (image < total) requestAnimationFrame(pas);
      else visuel!.textContent = texte;
    }
    requestAnimationFrame(pas);
  });

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{texte}</span>
      <span aria-hidden data-visuel>
        {texte}
      </span>
    </span>
  );
}
