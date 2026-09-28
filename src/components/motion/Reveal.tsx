"use client";

import { useRef, type CSSProperties, type ElementType, type ReactNode } from "react";
import { useReveal } from "./hooks";

export type VarianteReveal = "up" | "left" | "right" | "zoom" | "blur";

/**
 * Apparition au défilement (brief §3) : `up`, `left`, `right`, `zoom`, `blur`.
 *
 * L'état de départ masqué n'existe que sous `html[data-motion]` : sans
 * JavaScript, sous mouvement réduit ou « Animations : aucune », le bloc est
 * visible d'emblée (constellation.css). Un seul observateur pour toute la page
 * (`useReveal`).
 *
 * @param delay Décalage en secondes, pour échelonner (`--d`).
 */
export function Reveal({
  as: Balise = "div",
  variant = "up",
  delay = 0,
  className,
  style,
  children,
  id,
}: {
  as?: ElementType;
  variant?: VarianteReveal;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useReveal(ref);

  return (
    <Balise
      ref={ref}
      id={id}
      data-reveal={variant}
      className={className}
      style={delay ? ({ ...style, "--d": `${delay}s` } as CSSProperties) : style}
    >
      {children}
    </Balise>
  );
}

/** Étiquette de section : le trait se dessine quand elle apparaît. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useReveal(ref);
  return (
    <span ref={ref} className={`eyebrow ${className}`}>
      {children}
    </span>
  );
}
