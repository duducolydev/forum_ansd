"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * Crochets partagés du système d'animations « Constellation » (brief §2.2).
 *
 * Toutes les animations en JavaScript passent par `mouvementReduit()` : elle
 * vaut vrai sous `prefers-reduced-motion`, mais aussi quand le comité a choisi
 * « Animations : aucune » en BackOffice (§8.3, attribut `data-animations` de
 * `<html>`). Une seule question à se poser, au même endroit, pour tous les
 * effets.
 */

export function mouvementReduit(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.animations === "aucune"
  );
}

/** Pointeur précis (souris) : curseur, inclinaison et aimant n'ont de sens qu'avec lui. */
export function pointeurPrecis(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

function abonnerMedia(requete: string) {
  return (rappel: () => void) => {
    const media = window.matchMedia(requete);
    media.addEventListener("change", rappel);
    return () => media.removeEventListener("change", rappel);
  };
}

const abonnementMouvement = abonnerMedia("(prefers-reduced-motion: reduce)");
const abonnementPointeur = abonnerMedia("(pointer: fine)");

/**
 * Mouvement réduit, suivi en direct. Rendu serveur : `true` — le serveur rend
 * l'état final, immobile, que le client anime ensuite s'il en a le droit.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(abonnementMouvement, mouvementReduit, () => true);
}

/** Pointeur précis, suivi en direct. Rendu serveur : `false` (aucun effet de survol). */
export function useFinePointer(): boolean {
  return useSyncExternalStore(abonnementPointeur, pointeurPrecis, () => false);
}

/**
 * Vrai tant que l'élément est à l'écran. Sert à mettre en pause les boucles
 * `requestAnimationFrame` (canvas) dès qu'on ne les voit plus.
 */
export function useInView(ref: RefObject<Element | null>, marge = "0px"): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observateur = new IntersectionObserver(
      ([entree]) => setVisible(Boolean(entree?.isIntersecting)),
      { rootMargin: marge },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [ref, marge]);

  return visible;
}

/* ---------------------------------------------------------------------------
   Observateur d'apparition partagé (`useReveal`).

   Un seul `IntersectionObserver` pour toute la page, au lieu d'un par
   élément : une page d'accueil en compte plusieurs dizaines.

   Un élément apparaît quand 18 % de sa surface est visible (brief), **ou**
   quand il occupe déjà 40 % de la hauteur de la fenêtre : sans cette seconde
   règle, un bloc plus haut que cinq écrans n'atteindrait jamais 18 % visibles
   et resterait masqué. La marge haute immense reprend la leçon de `Reveal` :
   ce qui a été dépassé sans croiser la fenêtre (ancre, défilement restauré)
   doit compter comme vu, jamais rester invisible.
--------------------------------------------------------------------------- */

type Rappel = (element: Element) => void;
const rappels = new Map<Element, Rappel>();
let observateur: IntersectionObserver | null = null;

function observateurPartage(): IntersectionObserver {
  if (observateur) return observateur;
  observateur = new IntersectionObserver(
    (entrees) => {
      for (const entree of entrees) {
        if (!entree.isIntersecting) continue;
        const assez =
          entree.intersectionRatio >= 0.18 ||
          entree.intersectionRect.height >= window.innerHeight * 0.4;
        if (!assez) continue;
        const rappel = rappels.get(entree.target);
        rappels.delete(entree.target);
        observateur?.unobserve(entree.target);
        rappel?.(entree.target);
      }
    },
    { rootMargin: "100000px 0px 0px 0px", threshold: [0, 0.18, 0.4, 1] },
  );
  return observateur;
}

/** Surveille un élément ; `rappel` est appelé une seule fois, à son apparition. */
export function surveiller(element: Element, rappel: Rappel): () => void {
  rappels.set(element, rappel);
  observateurPartage().observe(element);
  return () => {
    rappels.delete(element);
    observateur?.unobserve(element);
  };
}

/**
 * Pose `data-vu` sur l'élément quand il apparaît — c'est ce que lisent les
 * règles `[data-reveal]` de constellation.css. Sous mouvement réduit, tout est
 * marqué vu d'emblée.
 */
export function useReveal(ref: RefObject<Element | null>, rappel?: Rappel): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const marquer = (cible: Element) => {
      (cible as HTMLElement).dataset.vu = "";
      rappel?.(cible);
    };
    if (mouvementReduit()) {
      marquer(element);
      return;
    }
    return surveiller(element, marquer);
    // `rappel` est volontairement hors des dépendances : l'apparition n'a lieu
    // qu'une fois, et un nouveau rappel à chaque rendu relancerait la surveillance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
