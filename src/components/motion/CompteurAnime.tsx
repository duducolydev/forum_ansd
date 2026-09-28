"use client";

import { useEffect, useRef } from "react";
import { mouvementReduit } from "@/components/motion/hooks";

/**
 * Nombre qui défile de 0 à sa valeur quand il entre à l'écran (chiffres clés).
 *
 * Le serveur rend la valeur finale : sans JavaScript, ou sous mouvement réduit,
 * le chiffre est juste d'emblée. Le lecteur d'écran lit la valeur, jamais les
 * étapes intermédiaires (`aria-hidden` sur le double animé).
 */
export function CompteurAnime({ valeur, duree = 1400 }: { valeur: number; duree?: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || mouvementReduit() || valeur === 0) return;

    const format = new Intl.NumberFormat("fr-FR");
    element.textContent = "0";
    let image = 0;

    const observateur = new IntersectionObserver(([entree]) => {
      if (!entree?.isIntersecting) return;
      observateur.disconnect();
      const debut = performance.now();
      function pas(maintenant: number) {
        const t = Math.min(1, (maintenant - debut) / duree);
        // Décélération en fin de course : le chiffre « se pose ».
        const adouci = 1 - Math.pow(1 - t, 3);
        element!.textContent = format.format(Math.round(valeur * adouci));
        if (t < 1) image = requestAnimationFrame(pas);
      }
      image = requestAnimationFrame(pas);
    });
    observateur.observe(element);

    return () => {
      observateur.disconnect();
      cancelAnimationFrame(image);
      element.textContent = format.format(valeur);
    };
  }, [valeur, duree]);

  return (
    <>
      <span className="sr-only">{valeur}</span>
      <span ref={ref} aria-hidden>
        {new Intl.NumberFormat("fr-FR").format(valeur)}
      </span>
    </>
  );
}
