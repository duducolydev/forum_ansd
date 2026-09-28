"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ParagrapheScrub } from "@/lib/mots-texte-riche";
import { mouvementReduit } from "./hooks";

/**
 * Texte qui s'allume mot à mot au défilement (brief §4.2) : chaque mot passe
 * d'une opacité de 0,14 à 1 à mesure que le paragraphe traverse l'écran ; les
 * mots clés (gras ou italique dans l'éditeur) passent en vert gras.
 *
 * Construit en JSX à partir de mots préparés côté serveur
 * (`motsDeTexteRiche`) : aucun `innerHTML`. Les mots sont mis à jour
 * directement dans le DOM, sans rendu React à chaque image de défilement.
 *
 * Sans JavaScript et sous mouvement réduit, tout est allumé : l'état éteint
 * n'est posé qu'une fois le script en main (`data-scrub`).
 *
 * Réservé aux textes courts de présentation : jamais sur le corps d'un
 * article (confort de lecture, brief §6).
 */
export function ScrubText({
  paragraphes,
  className = "",
}: {
  paragraphes: ParagrapheScrub[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [actif, setActif] = useState(false);

  useEffect(() => {
    const conteneur = ref.current;
    if (!conteneur || mouvementReduit()) return;
    setActif(true);
    const mots = [...conteneur.querySelectorAll<HTMLElement>(".mot-scrub")];
    let image = 0;
    let dernier = -1;

    function mesurer() {
      image = 0;
      if (!conteneur) return;
      const cadre = conteneur.getBoundingClientRect();
      const part = Math.min(
        1,
        Math.max(
          0,
          (window.innerHeight * 0.85 - cadre.top) / (cadre.height + window.innerHeight * 0.35),
        ),
      );
      const allumes = Math.floor(part * mots.length * 1.05);
      if (allumes === dernier) return;
      dernier = allumes;
      mots.forEach((mot, rang) => mot.toggleAttribute("data-on", rang < allumes));
    }
    function planifier() {
      if (!image) image = requestAnimationFrame(mesurer);
    }
    mesurer();
    window.addEventListener("scroll", planifier, { passive: true });
    window.addEventListener("resize", planifier);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
    };
  }, [paragraphes]);

  return (
    <div ref={ref} className={`texte-scrub ${className}`} data-scrub={actif ? "" : undefined}>
      {paragraphes.map((paragraphe, rangParagraphe) => (
        <p key={rangParagraphe}>
          {paragraphe.map((entree, rang) => {
            const mot = (
              <span className={`mot-scrub ${entree.cle ? "mot-scrub--cle" : ""}`}>
                {entree.mot}
              </span>
            );
            return (
              <span key={rang}>
                {entree.lien ? (
                  entree.lien.startsWith("/") ? (
                    <Link href={entree.lien} className="underline underline-offset-4">
                      {mot}
                    </Link>
                  ) : (
                    <a href={entree.lien} className="underline underline-offset-4">
                      {mot}
                    </a>
                  )
                ) : (
                  mot
                )}
                {rang < paragraphe.length - 1 ? " " : null}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
