"use client";

import { useEffect, useRef } from "react";
import { mouvementReduit } from "@/components/motion/hooks";

/**
 * Ondes colorées, décor de l'écran d'attente du direct.
 *
 * Cinq sinusoïdes de la palette publique glissent l'une sur l'autre à des
 * vitesses légèrement différentes. Le motif ne se répète jamais à l'identique,
 * ce qui le rend regardable longtemps — c'est tout ce qu'on lui demande
 * pendant une pause de vingt minutes — mais il reste assez lent pour ne jamais
 * tirer l'œil loin du message.
 *
 * Le coût par image est constant : cinq tracés, quel que soit l'écran. Un
 * décor de pause tourne des heures sur le vidéoprojecteur d'une salle et sur
 * des téléphones ; il ne doit pas chauffer.
 *
 * Mêmes garde-fous que `HeroNetwork` : arrêt hors écran et onglet caché,
 * `ResizeObserver` pour la taille, image unique et immobile sous mouvement
 * réduit. Le canvas ne porte aucun texte : les contrastes mesurés ne dépendent
 * pas de cette couche (constellation.css).
 */

const ONDES = [
  { couleur: "#1d4f91", amplitude: 0.1, periode: 1.3, vitesse: 0.00022, decalage: 0 },
  { couleur: "#2f8a3e", amplitude: 0.13, periode: 1.0, vitesse: -0.00017, decalage: 1.1 },
  { couleur: "#3b7dd8", amplitude: 0.09, periode: 1.7, vitesse: 0.00029, decalage: 2.4 },
  { couleur: "#e8b931", amplitude: 0.11, periode: 0.8, vitesse: -0.00013, decalage: 3.8 },
  { couleur: "#d64541", amplitude: 0.07, periode: 2.1, vitesse: 0.00021, decalage: 5.2 },
] as const;

function themeSombre(): boolean {
  const racine = document.documentElement;
  if (racine.dataset.theme) return racine.dataset.theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function FondOndes() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduit = mouvementReduit();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let largeur = 0;
    let hauteur = 0;
    let image = 0;
    let visible = true;
    let sombre = themeSombre();

    function dimensionner() {
      if (!canvas) return;
      const cadre = canvas.getBoundingClientRect();
      largeur = canvas.width = Math.round(cadre.width * dpr);
      hauteur = canvas.height = Math.round(cadre.height * dpr);
    }

    function dessiner(temps: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, largeur, hauteur);

      // Les ondes montent depuis le bas : le message occupe le haut et le
      // centre, le décor reste en dessous de lui.
      const base = hauteur * 0.62;
      // Un pas de 6 px à l'écran suffit : au-delà, la courbe ne gagne rien en
      // douceur et chaque segment coûte.
      const pas = Math.max(6 * dpr, largeur / 240);

      for (const onde of ONDES) {
        const phase = temps * onde.vitesse + onde.decalage;
        const amplitude = hauteur * onde.amplitude;
        const longueur = (largeur / onde.periode) * 0.5;

        ctx.beginPath();
        ctx.moveTo(0, hauteur);
        for (let x = 0; x <= largeur + pas; x += pas) {
          const y =
            base +
            Math.sin(x / longueur + phase) * amplitude +
            Math.sin(x / (longueur * 0.47) + phase * 1.6) * amplitude * 0.35;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(largeur, hauteur);
        ctx.closePath();

        ctx.fillStyle = onde.couleur;
        ctx.globalAlpha = sombre ? 0.16 : 0.12;
        ctx.fill();

        ctx.strokeStyle = onde.couleur;
        ctx.globalAlpha = sombre ? 0.4 : 0.3;
        ctx.lineWidth = 1.4 * dpr;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function boucle(temps: number) {
      dessiner(temps);
      image = requestAnimationFrame(boucle);
    }

    function relancer() {
      cancelAnimationFrame(image);
      image = 0;
      if (reduit) {
        dessiner(0);
        return;
      }
      if (visible && !document.hidden) image = requestAnimationFrame(boucle);
    }

    dimensionner();
    relancer();

    const observateurTaille = new ResizeObserver(() => {
      dimensionner();
      if (reduit) dessiner(0);
    });
    observateurTaille.observe(canvas);

    const observateurVue = new IntersectionObserver(([entree]) => {
      visible = Boolean(entree?.isIntersecting);
      relancer();
    });
    observateurVue.observe(canvas);

    const observateurTheme = new MutationObserver(() => {
      sombre = themeSombre();
      if (reduit) dessiner(0);
    });
    observateurTheme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    document.addEventListener("visibilitychange", relancer);

    return () => {
      cancelAnimationFrame(image);
      observateurTaille.disconnect();
      observateurVue.disconnect();
      observateurTheme.disconnect();
      document.removeEventListener("visibilitychange", relancer);
    };
  }, []);

  return (
    <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
  );
}
