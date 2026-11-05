"use client";

import { useEffect, useId, useRef } from "react";
import { Building2, Globe2, Mic, X } from "lucide-react";
import { lireLangue, selon } from "@/lib/langue";

/** Ce que la fiche détaillée d'un intervenant affiche. */
export interface ProfilIntervenant {
  nom: string;
  initiales: string;
  photoUrl: string | null;
  fonction?: string | null;
  organisation?: string | null;
  pays?: string | null;
  /** Libellés déjà traduits (« Panéliste », « Modération »…). */
  roles?: string[];
  /** Sessions où il intervient. */
  panels?: string[];
  themes?: string[];
  bio?: string | null;
}

/**
 * Fiche détaillée d'un intervenant, ouverte depuis sa carte (5 novembre 2026).
 *
 * Les cartes de /intervenants et des pages de panel ne s'ouvraient pas : seule
 * une biographie longue offrait un bouton, et un intervenant sans biographie
 * n'avait rien à cliquer. Toute carte ouvre désormais cette fiche, biographie
 * ou non.
 *
 * Contrôlée par le parent (`ouverte`, `onFermer`) : la carte entière, son
 * bouton et le lien `#intervenant-…` de l'accueil l'ouvrent tous.
 *
 * `<dialog>` natif, comme « Nous écrire » : piège du focus, touche Échap et
 * retour du focus sont assurés par le navigateur. Montée dans la carte, elle
 * s'affiche au-dessus de tout (couche supérieure) mais hérite de ses couleurs
 * et de son alignement — d'où les valeurs posées sur la fenêtre. Ses clics ne
 * remontent pas jusqu'à la carte, qui la rouvrirait.
 */
export function FenetreIntervenant({
  profil,
  ouverte,
  onFermer,
  langue: langueBrute,
}: {
  profil: ProfilIntervenant;
  ouverte: boolean;
  onFermer: () => void;
  langue: string;
}) {
  const langue = lireLangue(langueBrute);
  const refFenetre = useRef<HTMLDialogElement>(null);
  const idTitre = useId();

  useEffect(() => {
    const fenetre = refFenetre.current;
    if (!fenetre) return;
    if (ouverte && !fenetre.open) fenetre.showModal();
    if (!ouverte && fenetre.open) fenetre.close();
  }, [ouverte]);

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

  const bio = profil.bio?.trim();
  const lieu = [profil.organisation, profil.pays].filter(Boolean);

  return (
    <dialog
      ref={refFenetre}
      aria-labelledby={idTitre}
      onClose={onFermer}
      onClick={(evenement) => {
        evenement.stopPropagation();
        // Clic sur le voile (hors du panneau) : fermeture.
        if (evenement.target === refFenetre.current) onFermer();
      }}
      onKeyDown={(evenement) => evenement.stopPropagation()}
      className="bg-bg text-text m-auto w-[min(100%-2rem,44rem)] max-w-none cursor-auto rounded-2xl p-0 text-left text-base font-normal tracking-normal normal-case shadow-2xl backdrop:bg-[#050f23]/65 backdrop:backdrop-blur-sm"
    >
      {ouverte && (
        <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-7">
          <div className="flex items-start gap-4 sm:gap-5">
            {profil.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- servie par une route dédiée, hors optimiseur
              <img
                src={profil.photoUrl}
                alt=""
                className="border-border h-24 w-24 shrink-0 rounded-full border object-cover sm:h-28 sm:w-28"
              />
            ) : (
              <span
                aria-hidden
                className="bg-blue-soft text-blue-text font-display grid h-24 w-24 shrink-0 place-items-center rounded-full text-2xl font-bold sm:h-28 sm:w-28"
              >
                {profil.initiales}
              </span>
            )}
            <div className="min-w-0 flex-1">
              {profil.roles && profil.roles.length > 0 && (
                <p className="text-accent-text text-xs font-semibold tracking-wide uppercase">
                  {profil.roles.join(" · ")}
                </p>
              )}
              <h2
                id={idTitre}
                className="text-heading font-display mt-0.5 text-xl leading-snug font-semibold sm:text-2xl"
              >
                {profil.nom}
              </h2>
              {profil.fonction && <p className="text-text-2 mt-1 text-sm">{profil.fonction}</p>}
              {lieu.length > 0 && (
                <p className="text-text-3 mt-1 flex items-start gap-1.5 text-sm">
                  {profil.organisation ? (
                    <Building2 aria-hidden size={15} className="mt-0.5 shrink-0" />
                  ) : (
                    <Globe2 aria-hidden size={15} className="mt-0.5 shrink-0" />
                  )}
                  {lieu.join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onFermer}
              aria-label={selon(langue, { fr: "Fermer", en: "Close", pt: "Fechar" })}
              className="text-text-2 hover:bg-surface-2 hover:text-heading -mt-1 -mr-1 shrink-0 rounded-lg p-2"
            >
              <X aria-hidden size={20} />
            </button>
          </div>

          <h3 className="text-heading mt-6 text-sm font-semibold">
            {selon(langue, { fr: "Biographie", en: "Biography", pt: "Biografia" })}
          </h3>
          <p
            className={`mt-2 text-[0.95rem] leading-relaxed whitespace-pre-line ${bio ? "text-text-2" : "text-text-3 italic"}`}
          >
            {bio ||
              selon(langue, {
                fr: "Biographie à venir.",
                en: "Biography coming soon.",
                pt: "Biografia em breve.",
              })}
          </p>

          {profil.panels && profil.panels.length > 0 && (
            <>
              <h3 className="text-heading mt-6 text-sm font-semibold">
                {selon(langue, { fr: "Interventions", en: "Sessions", pt: "Intervenções" })}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {profil.panels.map((panel) => (
                  <li key={panel} className="text-text-2 flex items-start gap-2 text-sm">
                    <Mic aria-hidden size={15} className="text-accent-text mt-0.5 shrink-0" />
                    {panel}
                  </li>
                ))}
              </ul>
            </>
          )}

          {profil.themes && profil.themes.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {profil.themes.map((theme) => (
                <li
                  key={theme}
                  className="bg-blue-soft text-blue-text rounded-full px-3 py-1 text-xs font-semibold"
                >
                  {theme}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </dialog>
  );
}
