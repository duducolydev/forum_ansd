"use client";

import { selon, type Langue } from "@/lib/langue";
import { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { FormulaireContact } from "./formulaire-contact";
import { ATTRIBUT_NOUS_ECRIRE } from "./lien-nous-ecrire";

/**
 * Fenêtre « Nous écrire » (demande du 29 septembre 2026) : le formulaire de
 * contact, ouvert par-dessus la page depuis l'accueil ou le pied de page.
 *
 * Montée une fois dans le gabarit public. Les déclencheurs sont de simples
 * liens vers la rubrique Contacts portant `data-nous-ecrire` : un clic est
 * intercepté ici et ouvre la fenêtre ; sans JavaScript, le lien mène au
 * formulaire de la page Contacts. Les déclencheurs peuvent ainsi rester dans
 * des composants serveur.
 *
 * `<dialog>` natif : piège du focus, touche Échap et retour du focus au
 * déclencheur sont assurés par le navigateur.
 */
export function FenetreContact({ locale }: { locale: Langue }) {
  const refFenetre = useRef<HTMLDialogElement>(null);
  const [ouverte, setOuverte] = useState(false);
  // Change à chaque ouverture : formulaire vierge, et délai anti-robot remis
  // à zéro (il court depuis le montage du formulaire).
  const [ouverture, setOuverture] = useState(0);

  useEffect(() => {
    function surClic(evenement: MouseEvent) {
      if (evenement.defaultPrevented || evenement.button !== 0) return;
      if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
      const cible = (evenement.target as Element | null)?.closest(`[${ATTRIBUT_NOUS_ECRIRE}]`);
      if (!cible) return;
      evenement.preventDefault();
      setOuverture((n) => n + 1);
      setOuverte(true);
      refFenetre.current?.showModal();
    }
    document.addEventListener("click", surClic, true);
    return () => document.removeEventListener("click", surClic, true);
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

  return (
    <dialog
      ref={refFenetre}
      aria-labelledby="fenetre-contact-titre"
      onClose={() => setOuverte(false)}
      // Clic sur le voile (hors du panneau) : fermeture.
      onClick={(evenement) => {
        if (evenement.target === refFenetre.current) refFenetre.current?.close();
      }}
      className="fenetre-contact bg-bg text-text m-auto w-[min(100%-2rem,44rem)] max-w-none rounded-2xl p-0 shadow-2xl backdrop:bg-[#050f23]/65 backdrop:backdrop-blur-sm"
    >
      {ouverte && (
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2
                id="fenetre-contact-titre"
                className="text-heading font-display flex items-center gap-2 text-xl font-semibold"
              >
                <Send aria-hidden size={19} className="text-accent-text" />
                {selon(locale, { fr: "Nous écrire", en: "Write to us", pt: "Escreva-nos" })}
              </h2>
              <p className="text-text-2 mt-1 text-sm">
                {selon(locale, {
                  fr: "Votre message parvient directement au comité d'organisation.",
                  en: "Your message goes straight to the organising committee.",
                  pt: "A sua mensagem chega diretamente ao comité organizador.",
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refFenetre.current?.close()}
              aria-label={selon(locale, { fr: "Fermer", en: "Close", pt: "Fechar" })}
              className="text-text-2 hover:bg-surface-2 hover:text-heading shrink-0 rounded-lg p-2"
            >
              <X aria-hidden size={20} />
            </button>
          </div>
          <FormulaireContact key={ouverture} locale={locale} />
        </div>
      )}
    </dialog>
  );
}
