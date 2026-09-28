"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUp } from "lucide-react";
import { mouvementReduit, pointeurPrecis } from "./hooks";

/**
 * Effets globaux du site public (brief §3), montés une fois par `PublicShell`.
 *
 * - **Défilement** : barre de progression, en-tête compact, bouton « retour en
 *   haut » et son anneau. Un seul écouteur, une mise à jour par image au plus.
 * - **Pointeur** : curseur (point + anneau) et halo, dans **une seule** boucle
 *   `requestAnimationFrame`, arrêtée dès que la souris est immobile et que
 *   l'anneau a rattrapé le point — une boucle qui tourne à vide consomme autant
 *   qu'une animation.
 * - **Boutons** : aimant et ondulation, par délégation sur le document. Tout
 *   élément `[data-magnetic]` en profite, qu'il soit rendu par le serveur ou
 *   non, sans enveloppe autour de chaque bouton.
 * - **Pied de page** : collé sous le rideau seulement s'il tient dans la
 *   fenêtre ; sinon il reprend sa place normale, sans quoi il deviendrait
 *   inaccessible sur téléphone.
 *
 * Pas de curseur, de halo ni d'aimant sur écran tactile, sous mouvement
 * réduit, ni sur les pages marquées `data-sans-curseur` (formulaires
 * d'inscription, de connexion, Mon espace). Le curseur natif reste toujours
 * visible : le nôtre ne fait que l'accompagner.
 */

const CIBLES_GRANDES = "a, button, [data-curseur-grand]";

export function EffetsGlobaux() {
  const t = useTranslations("constellation");
  const chemin = usePathname();
  const refProgression = useRef<HTMLDivElement>(null);
  const refCurseur = useRef<HTMLDivElement>(null);
  const refAnneau = useRef<HTMLDivElement>(null);
  const refHalo = useRef<HTMLDivElement>(null);
  const refAnneauHaut = useRef<SVGCircleElement>(null);
  const [retourVisible, setRetourVisible] = useState(false);
  const [pointeurActif, setPointeurActif] = useState(false);

  /* Défilement : progression, en-tête compact, retour en haut. */
  useEffect(() => {
    let image = 0;
    const entete = document.querySelector<HTMLElement>(".entete-site");

    function mesurer() {
      image = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const part = max > 0 ? Math.min(1, y / max) : 0;
      if (refProgression.current) refProgression.current.style.transform = `scaleX(${part})`;
      if (refAnneauHaut.current)
        refAnneauHaut.current.style.strokeDashoffset = String(157 * (1 - part));
      if (entete) {
        if (y > 40) entete.dataset.compact = "";
        else delete entete.dataset.compact;
      }
      setRetourVisible(y > 600);
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
  }, [chemin]);

  /* Pied de page révélé, seulement s'il tient dans la fenêtre. */
  useEffect(() => {
    const pied = document.querySelector<HTMLElement>(".pied-revele");
    if (!pied) return;
    function ajuster() {
      if (!pied) return;
      if (pied.offsetHeight < window.innerHeight * 0.9) pied.dataset.reveleFooter = "";
      else delete pied.dataset.reveleFooter;
    }
    ajuster();
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(pied);
    window.addEventListener("resize", ajuster);
    return () => {
      observateur.disconnect();
      window.removeEventListener("resize", ajuster);
    };
  }, [chemin]);

  /* Curseur, halo et aimant. */
  useEffect(() => {
    const sansCurseur = Boolean(document.querySelector("[data-sans-curseur]"));
    if (mouvementReduit() || !pointeurPrecis()) return;
    const anneau = refAnneau.current;

    let x = -100;
    let y = -100;
    let ax = x;
    let ay = y;
    let hx = x;
    let hy = y;
    let image = 0;

    function boucle() {
      ax += (x - ax) * 0.15;
      ay += (y - ay) * 0.15;
      hx += (x - hx) * 0.08;
      hy += (y - hy) * 0.08;
      if (refAnneau.current)
        refAnneau.current.style.transform = `translate(${ax - 20}px, ${ay - 20}px)`;
      if (refHalo.current)
        refHalo.current.style.transform = `translate(${hx - 260}px, ${hy - 260}px)`;
      const immobile = Math.abs(x - hx) < 0.5 && Math.abs(y - hy) < 0.5;
      image = immobile ? 0 : requestAnimationFrame(boucle);
    }

    function suivre(evenement: PointerEvent) {
      if (evenement.pointerType !== "mouse") return;
      x = evenement.clientX;
      y = evenement.clientY;
      if (!sansCurseur) {
        setPointeurActif(true);
        if (refCurseur.current)
          refCurseur.current.style.transform = `translate(${x - 4}px, ${y - 4}px)`;
        if (!image) image = requestAnimationFrame(boucle);
      }

      // Projecteur : un halo suit la souris sur les tuiles `[data-projecteur]`.
      const tuile = (evenement.target as Element | null)?.closest<HTMLElement>("[data-projecteur]");
      if (tuile) {
        const cadreTuile = tuile.getBoundingClientRect();
        tuile.style.setProperty("--mx", `${x - cadreTuile.left}px`);
        tuile.style.setProperty("--my", `${y - cadreTuile.top}px`);
      }

      // Aimant : le bouton suit le pointeur de 25 % en largeur, 35 % en hauteur.
      const cible = (evenement.target as Element | null)?.closest<HTMLElement>("[data-magnetic]");
      if (cible && !sansCurseur) {
        const cadre = cible.getBoundingClientRect();
        cible.style.setProperty("--bx", `${(x - cadre.left - cadre.width / 2) * 0.25}px`);
        cible.style.setProperty("--by", `${(y - cadre.top - cadre.height / 2) * 0.35}px`);
      }
    }

    function entrer(evenement: PointerEvent) {
      const cible = evenement.target as Element | null;
      if (cible?.closest?.(CIBLES_GRANDES)) refAnneau.current?.setAttribute("data-grand", "");
    }
    function sortir(evenement: PointerEvent) {
      const cible = evenement.target as Element | null;
      const vers = evenement.relatedTarget as Element | null;
      if (cible?.closest?.(CIBLES_GRANDES) && !vers?.closest?.(CIBLES_GRANDES)) {
        refAnneau.current?.removeAttribute("data-grand");
      }
      const aimant = cible?.closest?.<HTMLElement>("[data-magnetic]");
      if (aimant && !aimant.contains(vers)) {
        aimant.style.setProperty("--bx", "0px");
        aimant.style.setProperty("--by", "0px");
      }
    }
    function quitterFenetre() {
      setPointeurActif(false);
    }

    document.addEventListener("pointermove", suivre, { passive: true });
    document.addEventListener("pointerover", entrer);
    document.addEventListener("pointerout", sortir);
    document.documentElement.addEventListener("pointerleave", quitterFenetre);
    return () => {
      cancelAnimationFrame(image);
      document.removeEventListener("pointermove", suivre);
      document.removeEventListener("pointerover", entrer);
      document.removeEventListener("pointerout", sortir);
      document.documentElement.removeEventListener("pointerleave", quitterFenetre);
      anneau?.removeAttribute("data-grand");
      setPointeurActif(false);
    };
  }, [chemin]);

  /* Ondulation au clic, sur tous les boutons aimantés — souris ou tactile. */
  useEffect(() => {
    if (mouvementReduit()) return;
    function onduler(evenement: MouseEvent) {
      const bouton = (evenement.target as Element | null)?.closest<HTMLElement>("[data-magnetic]");
      if (!bouton) return;
      const cadre = bouton.getBoundingClientRect();
      const taille = Math.max(cadre.width, cadre.height);
      const onde = document.createElement("span");
      onde.className = "ondulation";
      onde.setAttribute("aria-hidden", "true");
      onde.style.width = onde.style.height = `${taille}px`;
      onde.style.left = `${evenement.clientX - cadre.left - taille / 2}px`;
      onde.style.top = `${evenement.clientY - cadre.top - taille / 2}px`;
      bouton.appendChild(onde);
      window.setTimeout(() => onde.remove(), 700);
    }
    document.addEventListener("click", onduler);
    return () => document.removeEventListener("click", onduler);
  }, []);

  return (
    <>
      <div ref={refProgression} aria-hidden className="progression-lecture" />
      <div aria-hidden className={pointeurActif ? "curseur-actif" : undefined}>
        <div ref={refCurseur} className="curseur" />
        <div ref={refAnneau} className="curseur-anneau" />
      </div>
      {pointeurActif && <div ref={refHalo} aria-hidden className="halo-souris" />}
      <button
        type="button"
        className="retour-haut"
        data-visible={retourVisible ? "" : undefined}
        aria-label={t("backToTop")}
        tabIndex={retourVisible ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: mouvementReduit() ? "auto" : "smooth" })}
      >
        <svg aria-hidden viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
          <circle cx="28" cy="28" r="25" fill="none" strokeWidth="3" stroke="var(--line)" />
          <circle
            ref={refAnneauHaut}
            cx="28"
            cy="28"
            r="25"
            fill="none"
            strokeWidth="3"
            stroke="var(--green)"
            strokeDasharray="157"
            strokeDashoffset="157"
            strokeLinecap="round"
          />
        </svg>
        <ArrowUp aria-hidden size={20} />
      </button>
    </>
  );
}
