"use client";

import type { ReactNode } from "react";
import { Reveal as RevealMouvement } from "@/components/motion/Reveal";

/**
 * Apparition au défilement (§10), sur le système « Constellation ».
 *
 * Garde l'interface historique (`delai` en millisecondes) pour les dizaines
 * d'écrans qui l'emploient, et délègue au `Reveal` du système d'animations :
 * un seul observateur pour toute la page, un état de départ masqué qui
 * n'existe qu'avec JavaScript et hors mouvement réduit (constellation.css).
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
  return (
    <RevealMouvement variant="up" delay={delai / 1000} className={className}>
      {children}
    </RevealMouvement>
  );
}
