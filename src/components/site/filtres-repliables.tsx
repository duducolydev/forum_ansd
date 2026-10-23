"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/**
 * Panneau de filtres replié par défaut (demande du 23 octobre 2026) : le
 * programme et l'annuaire des intervenants s'affichent en entier, et les
 * filtres s'ouvrent à la demande.
 *
 * Ouvert d'emblée quand un filtre est déjà actif — un lien partagé vers
 * `/programme?jour=…` doit montrer ce qui restreint la liste, pas le cacher.
 * L'état ouvert/fermé est ensuite celui du visiteur : retirer un filtre ne
 * referme pas le panneau sous ses doigts (l'état d'un composant client survit
 * aux navigations vers la même page).
 *
 * Les filtres restent dans la page même repliés (`hidden`) : sans JavaScript,
 * rien n'est perdu, et les liens des pastilles restent indexables.
 */
export function FiltresRepliables({
  libelle,
  nbActifs = 0,
  actions,
  children,
}: {
  libelle: string;
  /** Filtres en cours : affichés sur le bouton, et ouvrent le panneau au départ. */
  nbActifs?: number;
  /** Commandes posées à droite du bouton (choix de l'affichage, par exemple). */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const [ouvert, setOuvert] = useState(nbActifs > 0);

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={id}
          onClick={() => setOuvert((valeur) => !valeur)}
          className={`transition-tout inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${
            ouvert
              ? "border-link bg-surface text-heading shadow-sm"
              : "border-border bg-surface text-text-2 hover:border-link hover:text-heading hover:-translate-y-0.5 hover:shadow-sm"
          }`}
        >
          <SlidersHorizontal aria-hidden size={15} />
          {libelle}
          {nbActifs > 0 && (
            <span className="bg-primary text-primary-text grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs">
              {nbActifs}
            </span>
          )}
          <ChevronDown
            aria-hidden
            size={15}
            className={`transition-transform duration-200 ${ouvert ? "rotate-180" : ""}`}
          />
        </button>
        {actions}
      </div>
      <div id={id} hidden={!ouvert} className="mt-3">
        {children}
      </div>
    </div>
  );
}
