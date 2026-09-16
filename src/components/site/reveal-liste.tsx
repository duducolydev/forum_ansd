"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Apparition au défilement pour une **liste entière** (§10.12).
 *
 * `Reveal` posé sur chaque carte créait une frontière client par élément : dix
 * partenaires, dix composants à hydrater, dix observateurs. Le coût s'est
 * mesuré — `/sponsors` est passé de **95 à 75** en performance, avec un temps de
 * blocage du fil principal de 700 ms.
 *
 * Ici, un seul composant client observe la grille ; l'échelonnement des enfants
 * est fait en CSS, qui n'a rien à hydrater. Le rendu visuel est le même.
 *
 * Mêmes précautions que `Reveal` : l'état de départ n'est posé que par le
 * script, et `prefers-reduced-motion` révèle tout immédiatement.
 */
export function RevealListe({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const cible = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = cible.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.dataset.reveleListe = "1";
      return;
    }

    element.dataset.reveleListe = "0";

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          element.dataset.reveleListe = "1";
          observateur.disconnect();
        }
      },
      // Même marge haute immense que `Reveal` : ce qui a été dépassé sans
      // croiser la fenêtre doit compter comme visible, jamais rester masqué.
      { rootMargin: "100000px 0px -10% 0px", threshold: 0 },
    );

    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return (
    <div ref={cible} className={className}>
      {children}
    </div>
  );
}
