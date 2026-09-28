"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Animations de la page d'accueil (demande du commanditaire, 28 septembre 2026).
 *
 * Trois règles, communes à tout ce fichier :
 *
 * 1. **`prefers-reduced-motion` coupe tout.** Le réseau est dessiné une fois,
 *    immobile ; le logo et les cartes ne bougent plus.
 * 2. **Rien ne tourne pour rien.** Le réseau s'arrête dès que le bandeau sort
 *    de l'écran ou que l'onglet passe en arrière-plan : une animation qui
 *    tourne sous la ligne de flottaison ne fait que vider la batterie des
 *    téléphones.
 * 3. **Décor seulement.** Le réseau, le halo et la barre de progression sont
 *    `aria-hidden` et ne portent aucun texte. Le compteur, lui, porte une
 *    valeur : elle est rendue **juste** par le serveur et c'est elle que lisent
 *    les lecteurs d'écran ; l'animation ne touche qu'un double visuel.
 */

function mouvementReduit(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vert: boolean;
}

/**
 * Réseau de points reliés, en fond du bandeau : des données qui circulent et
 * se connectent — le sujet du Forum. Les points s'écartent légèrement du
 * pointeur, ce qui donne au visiteur l'impression que la page lui répond.
 */
export function ReseauDonnees({ className = "" }: { className?: string }) {
  const refCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = refCanvas.current;
    const contexte = canvas?.getContext("2d");
    if (!canvas || !contexte) return;

    const reduit = mouvementReduit();
    let largeur = 0;
    let hauteur = 0;
    let points: Point[] = [];
    let image = 0;
    let visible = true;
    const pointeur = { x: -9999, y: -9999 };

    // Couleurs lues dans le thème, pour suivre le passage en sombre.
    function couleurs() {
      const style = getComputedStyle(document.documentElement);
      return {
        bleu: style.getPropertyValue("--ansd-bleu-vif").trim() || "#2f7fd1",
        vert: style.getPropertyValue("--ansd-vert-vif").trim() || "#3dbb6e",
      };
    }
    let teintes = couleurs();

    function dimensionner() {
      if (!canvas || !contexte) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      largeur = canvas.clientWidth;
      hauteur = canvas.clientHeight;
      canvas.width = Math.round(largeur * ratio);
      canvas.height = Math.round(hauteur * ratio);
      contexte.setTransform(ratio, 0, 0, ratio, 0, 0);
      // Densité proportionnelle à la surface, plafonnée : un écran large ne
      // doit pas se payer des milliers de segments par image.
      const nombre = Math.min(90, Math.round((largeur * hauteur) / 14000));
      points = Array.from({ length: nombre }, () => ({
        x: Math.random() * largeur,
        y: Math.random() * hauteur,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: 1.2 + Math.random() * 1.8,
        vert: Math.random() < 0.4,
      }));
    }

    function dessiner() {
      if (!contexte) return;
      contexte.clearRect(0, 0, largeur, hauteur);
      const distanceMax = 130;

      for (let i = 0; i < points.length; i += 1) {
        const a = points[i]!;
        for (let j = i + 1; j < points.length; j += 1) {
          const b = points[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance < distanceMax) {
            contexte.globalAlpha = (1 - distance / distanceMax) * 0.35;
            contexte.strokeStyle = a.vert && b.vert ? teintes.vert : teintes.bleu;
            contexte.lineWidth = 0.8;
            contexte.beginPath();
            contexte.moveTo(a.x, a.y);
            contexte.lineTo(b.x, b.y);
            contexte.stroke();
          }
        }
      }

      for (const point of points) {
        contexte.globalAlpha = 0.7;
        contexte.fillStyle = point.vert ? teintes.vert : teintes.bleu;
        contexte.beginPath();
        contexte.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        contexte.fill();
      }
      contexte.globalAlpha = 1;
    }

    function avancer() {
      for (const point of points) {
        // Le pointeur repousse doucement les points proches.
        const dx = point.x - pointeur.x;
        const dy = point.y - pointeur.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 110 && distance > 0.1) {
          const force = (110 - distance) / 110;
          point.vx += (dx / distance) * force * 0.06;
          point.vy += (dy / distance) * force * 0.06;
        }
        // Frottement léger, pour que l'écart s'amortisse au lieu de s'emballer.
        point.vx *= 0.985;
        point.vy *= 0.985;
        const vitesse = Math.hypot(point.vx, point.vy);
        if (vitesse < 0.08) {
          point.vx += (Math.random() - 0.5) * 0.04;
          point.vy += (Math.random() - 0.5) * 0.04;
        }
        point.x += point.vx;
        point.y += point.vy;
        if (point.x < -10) point.x = largeur + 10;
        if (point.x > largeur + 10) point.x = -10;
        if (point.y < -10) point.y = hauteur + 10;
        if (point.y > hauteur + 10) point.y = -10;
      }
    }

    function boucle() {
      avancer();
      dessiner();
      image = requestAnimationFrame(boucle);
    }

    function relancer() {
      cancelAnimationFrame(image);
      if (!reduit && visible && !document.hidden) image = requestAnimationFrame(boucle);
    }

    dimensionner();
    dessiner();
    relancer();

    const observateurTaille = new ResizeObserver(() => {
      dimensionner();
      dessiner();
    });
    observateurTaille.observe(canvas);

    const observateurVue = new IntersectionObserver(([entree]) => {
      visible = Boolean(entree?.isIntersecting);
      relancer();
    });
    observateurVue.observe(canvas);

    // Le pointeur est suivi sur la section parente : le canvas, sous le texte,
    // ne reçoit pas les événements (`pointer-events: none`).
    const parent = canvas.parentElement;
    function suivre(evenement: PointerEvent) {
      if (!canvas) return;
      const cadre = canvas.getBoundingClientRect();
      pointeur.x = evenement.clientX - cadre.left;
      pointeur.y = evenement.clientY - cadre.top;
    }
    function oublier() {
      pointeur.x = -9999;
      pointeur.y = -9999;
    }
    parent?.addEventListener("pointermove", suivre);
    parent?.addEventListener("pointerleave", oublier);
    document.addEventListener("visibilitychange", relancer);

    // Changement de thème : nouvelles teintes au prochain dessin.
    const observateurTheme = new MutationObserver(() => {
      teintes = couleurs();
      if (reduit) dessiner();
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
      parent?.removeEventListener("pointermove", suivre);
      parent?.removeEventListener("pointerleave", oublier);
      document.removeEventListener("visibilitychange", relancer);
    };
  }, []);

  return (
    <canvas
      ref={refCanvas}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}

/**
 * Inclinaison 3D qui suit le pointeur.
 *
 * Sert au grand logo du bandeau et aux cartes d'intervenants. L'angle est
 * lissé d'une image à l'autre (interpolation), sans quoi le mouvement suit la
 * souris par à-coups. Au départ du pointeur, l'élément revient à plat.
 */
export function Inclinaison({
  children,
  className = "",
  angleMax = 10,
  echelle = 1,
}: {
  children: ReactNode;
  className?: string;
  /** Angle maximal, en degrés. */
  angleMax?: number;
  /** Grossissement au survol. */
  echelle?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || mouvementReduit()) return;
    // Sur un écran tactile, pas de survol : l'effet n'aurait pas de sens.
    if (!window.matchMedia("(hover: hover)").matches) return;

    const cible = { x: 0, y: 0, s: 1 };
    const actuel = { x: 0, y: 0, s: 1 };
    let image = 0;

    function animer() {
      actuel.x += (cible.x - actuel.x) * 0.12;
      actuel.y += (cible.y - actuel.y) * 0.12;
      actuel.s += (cible.s - actuel.s) * 0.12;
      element!.style.transform = `perspective(900px) rotateX(${actuel.x.toFixed(2)}deg) rotateY(${actuel.y.toFixed(2)}deg) scale(${actuel.s.toFixed(3)})`;
      const immobile =
        Math.abs(cible.x - actuel.x) < 0.01 &&
        Math.abs(cible.y - actuel.y) < 0.01 &&
        Math.abs(cible.s - actuel.s) < 0.001;
      image = immobile ? 0 : requestAnimationFrame(animer);
    }
    function demarrer() {
      if (!image) image = requestAnimationFrame(animer);
    }

    function suivre(evenement: PointerEvent) {
      const cadre = element!.getBoundingClientRect();
      const px = (evenement.clientX - cadre.left) / cadre.width - 0.5;
      const py = (evenement.clientY - cadre.top) / cadre.height - 0.5;
      cible.x = -py * angleMax * 2;
      cible.y = px * angleMax * 2;
      cible.s = echelle;
      demarrer();
    }
    function relacher() {
      cible.x = 0;
      cible.y = 0;
      cible.s = 1;
      demarrer();
    }

    element.addEventListener("pointermove", suivre);
    element.addEventListener("pointerleave", relacher);
    return () => {
      cancelAnimationFrame(image);
      element.removeEventListener("pointermove", suivre);
      element.removeEventListener("pointerleave", relacher);
    };
  }, [angleMax, echelle]);

  return (
    <div ref={ref} className={`will-change-transform [transform-style:preserve-3d] ${className}`}>
      {children}
    </div>
  );
}

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

/**
 * Fine barre de progression de lecture, en haut de l'écran.
 *
 * Mise à jour au plus une fois par image, et en `transform` seulement : le
 * navigateur la compose sans recalculer la mise en page.
 */
export function BarreProgression() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const barre = ref.current;
    if (!barre) return;
    let image = 0;

    function mesurer() {
      image = 0;
      const hauteur = document.documentElement.scrollHeight - window.innerHeight;
      const part = hauteur > 0 ? Math.min(1, window.scrollY / hauteur) : 0;
      barre!.style.transform = `scaleX(${part})`;
    }
    function planifier() {
      if (!image) image = requestAnimationFrame(mesurer);
    }

    mesurer();
    window.addEventListener("scroll", planifier, { passive: true });
    window.addEventListener("resize", planifier);
    return () => {
      cancelAnimationFrame(image);
      window.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="from-ansd-bleu-vif to-ansd-vert-vif pointer-events-none fixed inset-x-0 top-0 z-[70] h-[3px] origin-left scale-x-0 bg-gradient-to-r"
    />
  );
}
