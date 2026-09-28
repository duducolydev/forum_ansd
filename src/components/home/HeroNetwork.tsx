"use client";

import { useEffect, useRef } from "react";
import { mouvementReduit } from "@/components/motion/hooks";

/**
 * Réseau de données vivant, en fond du bandeau (brief §4.1).
 *
 * Des nœuds colorés dérivent, se relient sous 140 px, et des paquets lumineux
 * voyagent sur les liens. Le pointeur repousse les nœuds proches et tire des
 * liens vers eux. Jusqu'à 110 nœuds selon la surface.
 *
 * Mode `leger` (bandeaux des pages intérieures, brief §6) : 40 nœuds au plus,
 * sans paquets.
 *
 * Par rapport au template, la boucle **s'arrête** quand le canvas sort de
 * l'écran ou que l'onglet passe en arrière-plan, et le canvas suit sa taille
 * par `ResizeObserver`. Sous mouvement réduit, une seule image, immobile.
 *
 * Chargé par `next/dynamic` sans rendu serveur : il n'y a rien à rendre avant
 * que le navigateur ait une taille de fenêtre.
 */

const COULEURS = ["#2f8a3e", "#3b7dd8", "#e8b931", "#1d4f91", "#d64541"];

interface Noeud {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  c: string;
  ph: number;
}

interface Paquet {
  p: Noeud;
  q: Noeud;
  t: number;
  c: string;
}

function themeSombre(): boolean {
  const racine = document.documentElement;
  if (racine.dataset.theme) return racine.dataset.theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function HeroNetwork({ leger = false }: { leger?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduit = mouvementReduit();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const LIEN = 140 * dpr;
    let largeur = 0;
    let hauteur = 0;
    let noeuds: Noeud[] = [];
    let paquets: Paquet[] = [];
    let image = 0;
    let visible = true;
    let sombre = themeSombre();
    const souris = { x: -1e4, y: -1e4 };

    function dimensionner() {
      if (!canvas) return;
      const cadre = canvas.getBoundingClientRect();
      largeur = canvas.width = Math.round(cadre.width * dpr);
      hauteur = canvas.height = Math.round(cadre.height * dpr);
      const plafond = leger ? 40 : 110;
      const nombre = Math.min(plafond, Math.floor((cadre.width * cadre.height) / 11000));
      noeuds = Array.from({ length: nombre }, () => ({
        x: Math.random() * largeur,
        y: Math.random() * hauteur,
        vx: (Math.random() - 0.5) * 0.35 * dpr,
        vy: (Math.random() - 0.5) * 0.35 * dpr,
        r: (Math.random() * 2 + 1) * dpr,
        c: COULEURS[Math.floor(Math.random() * COULEURS.length)]!,
        ph: Math.random() * 6.28,
      }));
      paquets = [];
    }

    function dessiner(temps: number, bouger: boolean) {
      if (!ctx) return;
      ctx.clearRect(0, 0, largeur, hauteur);

      for (const n of noeuds) {
        if (bouger) {
          n.x += n.vx;
          n.y += n.vy;
        }
        if (n.x < 0 || n.x > largeur) n.vx *= -1;
        if (n.y < 0 || n.y > hauteur) n.vy *= -1;
        const dx = n.x - souris.x;
        const dy = n.y - souris.y;
        const d = Math.hypot(dx, dy);
        if (bouger && d < 160 * dpr && d > 0) {
          n.x += (dx / d) * 1.2;
          n.y += (dy / d) * 1.2;
        }
      }

      ctx.lineWidth = dpr * 0.8;
      for (let a = 0; a < noeuds.length; a += 1) {
        for (let b = a + 1; b < noeuds.length; b += 1) {
          const p = noeuds[a]!;
          const q = noeuds[b]!;
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d >= LIEN) continue;
          ctx.strokeStyle = sombre
            ? `rgba(143,186,255,${(1 - d / LIEN) * 0.35})`
            : `rgba(29,79,145,${(1 - d / LIEN) * 0.22})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
          if (bouger && !leger && Math.random() < 0.0009 && paquets.length < 40) {
            paquets.push({ p, q, t: 0, c: Math.random() < 0.5 ? "#2f8a3e" : "#e8b931" });
          }
        }
      }

      paquets = paquets.filter((k) => {
        k.t += 0.018;
        const x = k.p.x + (k.q.x - k.p.x) * k.t;
        const y = k.p.y + (k.q.y - k.p.y) * k.t;
        ctx.fillStyle = k.c;
        ctx.shadowColor = k.c;
        ctx.shadowBlur = 12 * dpr;
        ctx.beginPath();
        ctx.arc(x, y, 2.4 * dpr, 0, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        return k.t < 1;
      });

      for (const n of noeuds) {
        const s = bouger ? 1 + Math.sin(temps / 700 + n.ph) * 0.35 : 1;
        ctx.fillStyle = n.c;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * s, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const n of noeuds) {
        const d = Math.hypot(n.x - souris.x, n.y - souris.y);
        if (d >= 220 * dpr) continue;
        ctx.strokeStyle = `rgba(47,138,62,${(1 - d / (220 * dpr)) * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(souris.x, souris.y);
        ctx.stroke();
      }
    }

    function boucle(temps: number) {
      dessiner(temps, true);
      image = requestAnimationFrame(boucle);
    }

    function relancer() {
      cancelAnimationFrame(image);
      image = 0;
      if (reduit) {
        dessiner(0, false);
        return;
      }
      if (visible && !document.hidden) image = requestAnimationFrame(boucle);
    }

    dimensionner();
    relancer();

    const observateurTaille = new ResizeObserver(() => {
      dimensionner();
      if (reduit) dessiner(0, false);
    });
    observateurTaille.observe(canvas);

    const observateurVue = new IntersectionObserver(([entree]) => {
      visible = Boolean(entree?.isIntersecting);
      relancer();
    });
    observateurVue.observe(canvas);

    // Le pointeur est suivi sur la section : le canvas, sous le texte, ne
    // reçoit aucun événement.
    const zone = canvas.parentElement;
    function suivre(evenement: PointerEvent) {
      if (!canvas || evenement.pointerType !== "mouse") return;
      const cadre = canvas.getBoundingClientRect();
      souris.x = (evenement.clientX - cadre.left) * dpr;
      souris.y = (evenement.clientY - cadre.top) * dpr;
    }
    function oublier() {
      souris.x = souris.y = -1e4;
    }
    zone?.addEventListener("pointermove", suivre);
    zone?.addEventListener("pointerleave", oublier);
    document.addEventListener("visibilitychange", relancer);

    const observateurTheme = new MutationObserver(() => {
      sombre = themeSombre();
      if (reduit) dessiner(0, false);
    });
    observateurTheme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      cancelAnimationFrame(image);
      observateurTaille.disconnect();
      observateurVue.disconnect();
      observateurTheme.disconnect();
      zone?.removeEventListener("pointermove", suivre);
      zone?.removeEventListener("pointerleave", oublier);
      document.removeEventListener("visibilitychange", relancer);
    };
  }, [leger]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
    />
  );
}
