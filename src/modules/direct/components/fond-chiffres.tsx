"use client";

import { useEffect, useRef } from "react";
import { mouvementReduit } from "@/components/motion/hooks";

/**
 * Pluie de chiffres, décor de l'écran d'attente du direct.
 *
 * Des colonnes de chiffres descendent lentement et se régénèrent en haut, avec
 * une tête plus lumineuse que la traîne. Le motif est volontairement lisible —
 * ce sont des chiffres, pas des glyphes : c'est le Forum d'une agence de
 * statistique, et le décor dit ce qu'on y fait.
 *
 * Trois écarts avec l'effet dont il s'inspire, tous délibérés :
 *
 * - **Lent.** Une chute rapide donne un écran de panne de film, pas une pause
 *   de conférence.
 * - **Discret.** L'opacité plafonne bien en dessous du texte, qui est posé sur
 *   son propre fond : le décor ne participe à aucun contraste mesuré.
 * - **Borné.** Le nombre de colonnes est plafonné quelle que soit la surface,
 *   pour qu'un vidéoprojecteur en 4K ne coûte pas dix fois un téléphone.
 */

const COULEURS = ["#2f8a3e", "#3b7dd8", "#1d4f91", "#e8b931"] as const;
const COLONNES_MAX = 48;

interface Colonne {
  x: number;
  y: number;
  vitesse: number;
  longueur: number;
  couleur: string;
  chiffres: string[];
}

function themeSombre(): boolean {
  const racine = document.documentElement;
  if (racine.dataset.theme) return racine.dataset.theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function FondChiffres() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduit = mouvementReduit();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let largeur = 0;
    let hauteur = 0;
    let corps = 0;
    let colonnes: Colonne[] = [];
    let image = 0;
    let visible = true;
    let sombre = themeSombre();
    let precedent = 0;

    function chiffre(): string {
      return String(Math.floor(Math.random() * 10));
    }

    function dimensionner() {
      if (!canvas) return;
      const cadre = canvas.getBoundingClientRect();
      largeur = canvas.width = Math.round(cadre.width * dpr);
      hauteur = canvas.height = Math.round(cadre.height * dpr);
      corps = Math.max(14, Math.round(cadre.width / 70)) * dpr;

      const nombre = Math.min(COLONNES_MAX, Math.max(8, Math.floor(largeur / (corps * 2.2))));
      const pas = largeur / nombre;
      colonnes = Array.from({ length: nombre }, (_, rang) => {
        const longueur = Math.floor(Math.random() * 10) + 6;
        return {
          // Décalage aléatoire dans la colonne : une grille parfaite se voit.
          x: pas * rang + pas * 0.5 + (Math.random() - 0.5) * pas * 0.4,
          y: Math.random() * hauteur,
          // Pixels par seconde, indépendant de la fréquence de l'écran.
          vitesse: (14 + Math.random() * 22) * dpr,
          longueur,
          couleur: COULEURS[Math.floor(Math.random() * COULEURS.length)]!,
          chiffres: Array.from({ length: longueur }, chiffre),
        };
      });
    }

    function dessiner(secondes: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, largeur, hauteur);
      ctx.font = `600 ${corps}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const colonne of colonnes) {
        colonne.y += colonne.vitesse * secondes;
        if (colonne.y - colonne.longueur * corps > hauteur) {
          colonne.y = -Math.random() * hauteur * 0.5;
          colonne.couleur = COULEURS[Math.floor(Math.random() * COULEURS.length)]!;
        }

        // Un seul chiffre change par colonne et par image : l'ensemble
        // frémit sans scintiller, et la chaîne reste lisible.
        if (secondes > 0 && Math.random() < 0.3) {
          colonne.chiffres[Math.floor(Math.random() * colonne.longueur)] = chiffre();
        }

        for (let rang = 0; rang < colonne.longueur; rang += 1) {
          const y = colonne.y - rang * corps;
          if (y < -corps || y > hauteur + corps) continue;
          const part = 1 - rang / colonne.longueur;
          ctx.globalAlpha = (sombre ? 0.34 : 0.26) * part * part;
          ctx.fillStyle = rang === 0 ? (sombre ? "#ffffff" : colonne.couleur) : colonne.couleur;
          ctx.fillText(colonne.chiffres[rang]!, colonne.x, y);
        }
      }
      ctx.globalAlpha = 1;
    }

    function boucle(temps: number) {
      // Borné à 50 ms : un onglet revenu au premier plan après une minute ne
      // doit pas faire sauter les colonnes d'un écran entier.
      const secondes = precedent ? Math.min((temps - precedent) / 1000, 0.05) : 0;
      precedent = temps;
      dessiner(secondes);
      image = requestAnimationFrame(boucle);
    }

    function relancer() {
      cancelAnimationFrame(image);
      image = 0;
      precedent = 0;
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
