"use client";

import { useEffect, useRef } from "react";
import { mouvementReduit, useInView } from "@/components/motion/hooks";

/**
 * Visuel génératif d'une actualité sans couverture (brief §4.4) : vagues
 * colorées et particules montantes sur fond bleu nuit.
 *
 * La graine et les couleurs sont **dérivées de l'identifiant** de l'article :
 * le même article garde le même visuel d'une visite à l'autre. La boucle ne
 * tourne que quand le visuel est à l'écran ; sous mouvement réduit, une seule
 * image.
 */

const PALETTES: [string, string][] = [
  ["#2f8a3e", "#e8b931"],
  ["#3b7dd8", "#d64541"],
  ["#e8b931", "#3b7dd8"],
  ["#4cb46a", "#3b7dd8"],
  ["#d64541", "#e8b931"],
];

/** Empreinte stable d'une chaîne (FNV-1a), pour une graine reproductible. */
export function graineDe(texte: string): number {
  let empreinte = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    empreinte ^= texte.charCodeAt(i);
    empreinte = Math.imul(empreinte, 16777619);
  }
  return empreinte >>> 0;
}

export default function NewsCanvas({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const visible = useInView(ref, "100px");

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const graine = graineDe(id);
    const [c1, c2] = PALETTES[graine % PALETTES.length]!;
    const decalage = (graine % 1000) / 100;
    const vitesse = 1 + (graine % 5) * 0.15;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let largeur = 0;
    let hauteur = 0;

    function dimensionner() {
      if (!canvas) return;
      largeur = canvas.width = Math.round(canvas.offsetWidth * dpr);
      hauteur = canvas.height = Math.round(canvas.offsetHeight * dpr);
    }

    function dessiner(tMs: number) {
      if (!ctx) return;
      const t = tMs / 1000;
      ctx.fillStyle = "#081a33";
      ctx.fillRect(0, 0, largeur, hauteur);
      for (let k = 0; k < 3; k += 1) {
        ctx.beginPath();
        for (let i = 0; i <= 40; i += 1) {
          const x = (i / 40) * largeur;
          const y =
            hauteur * 0.55 +
            (Math.sin(i * 0.3 * (k + 1) + t * (1 + k * 0.4) * vitesse + decalage) *
              hauteur *
              0.18) /
              (k + 1);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(largeur, hauteur);
        ctx.lineTo(0, hauteur);
        const degrade = ctx.createLinearGradient(0, 0, 0, hauteur);
        degrade.addColorStop(0, (k % 2 === 0 ? c1 : c2) + (k ? "55" : "aa"));
        degrade.addColorStop(1, "#081a3300");
        ctx.fillStyle = degrade;
        ctx.fill();
      }
      for (let i = 0; i < 24; i += 1) {
        const y = (i * 97.3 + t * 20 * vitesse * 3) % hauteur;
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.fillRect((i / 24) * largeur, hauteur - y, 2 * dpr, 2 * dpr);
      }
    }

    dimensionner();
    const observateur = new ResizeObserver(() => {
      dimensionner();
      dessiner(performance.now());
    });
    observateur.observe(canvas);

    if (mouvementReduit() || !visible) {
      dessiner(decalage * 1000);
      return () => observateur.disconnect();
    }

    let image = 0;
    function boucle(temps: number) {
      dessiner(temps);
      image = requestAnimationFrame(boucle);
    }
    image = requestAnimationFrame(boucle);
    return () => {
      cancelAnimationFrame(image);
      observateur.disconnect();
    };
  }, [id, visible]);

  return <canvas ref={ref} aria-hidden className="block h-full w-full" />;
}
