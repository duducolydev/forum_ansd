"use client";

import { selon, type Langue } from "@/lib/langue";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, UserPlus, X } from "lucide-react";
import { BoutonSite, LienSite } from "@/components/site/bouton-site";

/**
 * Fermée, la fenêtre ne revient pas avant la prochaine ouverture du navigateur
 * (26 octobre 2026) : cookie **de session**, sans date d'expiration, que le
 * navigateur efface en se fermant. Un cookie plutôt que `sessionStorage`, propre
 * à chaque onglet : ouvrir l'accueil dans un second onglet ne la remontre pas.
 */
const COOKIE_VUE = "forum-fenetre-acces";

/** Laisse la page d'accueil apparaître avant la fenêtre. */
const ATTENTE_MS = 1200;

function dejaVue(): boolean {
  return document.cookie.split("; ").some((cookie) => cookie.startsWith(`${COOKIE_VUE}=`));
}

function retenir(): void {
  const securise = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_VUE}=vue; path=/; SameSite=Lax${securise}`;
}

/**
 * Conditions d'accès au Forum (demande du 23 octobre 2026) : une fenêtre sur
 * l'accueil rappelle que l'inscription préalable est obligatoire et mène au
 * formulaire.
 *
 * Montée par l'accueil **seulement quand les inscriptions sont ouvertes** :
 * inviter à « s'inscrire dès maintenant » quand le guichet est fermé enverrait
 * le visiteur vers un refus. Et seulement tant qu'aucun compte participant ne
 * s'est connecté sur ce navigateur (`compteDejaConnecte`).
 *
 * Une fois fermée — croix, « Plus tard », Échap, clic sur le voile ou
 * « S'inscrire » —, elle revient à la prochaine ouverture du navigateur.
 * `<dialog>` natif, comme « Nous écrire » : piège du focus, Échap et retour du
 * focus sont assurés par le navigateur. Elle ne s'ouvre pas par-dessus une
 * autre fenêtre déjà ouverte.
 */
export function FenetreAccesForum({ locale }: { locale: Langue }) {
  const refFenetre = useRef<HTMLDialogElement>(null);
  const [ouverte, setOuverte] = useState(false);

  useEffect(() => {
    if (dejaVue()) return;
    const minuterie = window.setTimeout(() => {
      if (document.querySelector("dialog[open]")) return;
      refFenetre.current?.showModal();
      setOuverte(true);
    }, ATTENTE_MS);
    return () => window.clearTimeout(minuterie);
  }, []);

  // Pas de défilement de la page sous la fenêtre.
  useEffect(() => {
    if (!ouverte) return;
    const racine = document.documentElement;
    const avant = racine.style.overflow;
    racine.style.overflow = "hidden";
    return () => {
      racine.style.overflow = avant;
    };
  }, [ouverte]);

  const fermer = () => refFenetre.current?.close();

  return (
    <dialog
      ref={refFenetre}
      aria-labelledby="fenetre-acces-titre"
      aria-describedby="fenetre-acces-texte"
      onClose={() => {
        retenir();
        setOuverte(false);
      }}
      // Clic sur le voile (hors du panneau) : fermeture.
      onClick={(evenement) => {
        if (evenement.target === refFenetre.current) fermer();
      }}
      className="bg-bg text-text m-auto w-[min(100%-2rem,36rem)] max-w-none rounded-2xl p-0 shadow-2xl backdrop:bg-[#050f23]/65 backdrop:backdrop-blur-sm"
    >
      {ouverte && (
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="fenetre-acces-titre"
              className="text-heading font-display flex items-center gap-2.5 text-xl font-semibold text-balance"
            >
              <BadgeCheck aria-hidden size={22} className="text-accent-text shrink-0" />
              {selon(locale, {
                fr: "Inscription obligatoire pour accéder au Forum",
                en: "Registration required to attend the Forum",
                pt: "Inscrição obrigatória para aceder ao Fórum",
              })}
            </h2>
            <button
              type="button"
              onClick={fermer}
              aria-label={selon(locale, { fr: "Fermer", en: "Close", pt: "Fechar" })}
              className="text-text-2 hover:bg-surface-2 hover:text-heading shrink-0 rounded-lg p-2"
            >
              <X aria-hidden size={20} />
            </button>
          </div>

          <div id="fenetre-acces-texte" className="text-text-2 mt-4 flex flex-col gap-3">
            <p>
              {selon(locale, {
                fr: "L’inscription préalable sur ce site est obligatoire pour accéder au Forum. Elle vous permettra d’obtenir votre badge d’accès, qui sera exigé à l’entrée.",
                en: "Prior registration on this website is required to attend the Forum. It will allow you to obtain your access badge, which will be required at the entrance.",
                pt: "A inscrição prévia neste sítio é obrigatória para aceder ao Fórum. Permitir-lhe-á obter o seu crachá de acesso, que será exigido à entrada.",
              })}
            </p>
            <p>
              {selon(locale, {
                fr: "Afin de faciliter l’accueil des participants et d’assurer le bon déroulement de l’événement, nous vous invitons à vous inscrire dès maintenant.",
                en: "To make welcoming participants easier and to ensure the event runs smoothly, we invite you to register now.",
                pt: "Para facilitar o acolhimento dos participantes e assegurar o bom decorrer do evento, convidamo-lo a inscrever-se desde já.",
              })}
            </p>
            {/* Validation par le comité (demande du 27 octobre 2026). */}
            <p>
              <strong className="text-heading font-semibold">
                {selon(locale, { fr: "NB :", en: "NB:", pt: "NB:" })}
              </strong>{" "}
              {selon(locale, {
                fr: "Le nombre de places étant limité, la validation de votre inscription se fera par le Comité d’organisation et vous serez notifié(e).",
                en: "As the number of places is limited, your registration will be subject to approval by the Organizing Committee, and you will be notified accordingly.",
                pt: "Como o número de vagas é limitado, a validação da sua inscrição será feita pelo Comitê Organizador, e você será notificado(a).",
              })}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <LienSite href="/inscription" ton="principal" icone={UserPlus} onClick={fermer}>
              {selon(locale, {
                fr: "S'inscrire maintenant",
                en: "Register now",
                pt: "Inscrever-se agora",
              })}
            </LienSite>
            <BoutonSite type="button" ton="discret" onClick={fermer}>
              {selon(locale, { fr: "Plus tard", en: "Later", pt: "Mais tarde" })}
            </BoutonSite>
          </div>
        </div>
      )}
    </dialog>
  );
}
