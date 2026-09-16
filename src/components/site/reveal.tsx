"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Apparition au défilement (§10).
 *
 * L'état de départ n'est posé qu'**une fois le script en main** : l'attribut
 * `data-revele` passe à « 0 » depuis l'effet, jamais au rendu serveur. Sans
 * cette précaution, une page servie sans JavaScript — ou avant hydratation —
 * afficherait du contenu invisible, ce qui est bien pire qu'une page sans
 * animation.
 *
 * `prefers-reduced-motion` est respecté sans code : la transition passe par
 * `--duree-animation`, mise à zéro par la feuille de style dans ce cas. On
 * révèle donc immédiatement, sans mouvement.
 */
export function Reveal({
  children,
  delai = 0,
  className = "",
}: {
  children: ReactNode;
  /** Décalage en millisecondes, pour échelonner une grille. */
  delai?: number;
  className?: string;
}) {
  const cible = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = cible.current;
    if (!element) return;

    // Mouvement réduit : on affiche tout de suite, sans observer quoi que ce soit.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.revele = "1";
      return;
    }

    element.dataset.revele = "0";
    element.style.transitionDelay = `${delai}ms`;

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          element.dataset.revele = "1";
          // Une seule fois : une section qui rejoue son apparition à chaque
          // passage devient fatigante bien avant d'être remarquée.
          observateur.disconnect();
        }
      },
      /*
       * La marge haute est volontairement immense.
       *
       * Sans elle, tout ce qui a été **dépassé** sans jamais croiser la fenêtre
       * — arrivée sur une ancre, position de défilement restaurée au
       * rechargement, molette rapide — restait invisible pour de bon. Le défaut
       * a été constaté en test : un saut jusqu'au bas de page laissait quatre
       * sections masquées. En étendant la racine loin au-dessus, tout ce qui est
       * au-dessus de la fenêtre compte comme visible et se révèle aussitôt ; la
       * marge basse négative conserve l'apparition juste avant l'entrée à
       * l'écran, qui est le seul effet recherché.
       */
      { rootMargin: "100000px 0px -10% 0px", threshold: 0 },
    );

    observateur.observe(element);
    return () => observateur.disconnect();
  }, [delai]);

  return (
    <div ref={cible} className={className}>
      {children}
    </div>
  );
}
