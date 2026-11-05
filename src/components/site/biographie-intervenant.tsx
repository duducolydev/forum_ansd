"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { BookOpen, X } from "lucide-react";
import { lireLangue, selon } from "@/lib/langue";
import { extraitBiographie } from "@/lib/biographie";

/**
 * Biographie d'un intervenant sur une carte : le début, et la suite à la
 * demande (5 novembre 2026).
 *
 * Les biographies peuvent compter jusqu'à 600 mots. Sur la carte retournable
 * de /intervenants, elles étaient coupées à sept lignes sans moyen de lire le
 * reste ; sur la fiche d'un panel, les déplier allongeait la carte de toute
 * leur hauteur. La carte n'en montre donc qu'un extrait, coupé à la fin d'un
 * mot, et « Lire la biographie » ouvre la fiche entière dans une fenêtre.
 *
 * `<dialog>` natif, comme la fenêtre « Nous écrire » : piège du focus, touche
 * Échap et retour du focus au bouton sont assurés par le navigateur. Montée
 * dans la carte, elle s'affiche pourtant au-dessus de tout (couche
 * supérieure) — mais hérite de ses couleurs et de son alignement, d'où les
 * valeurs posées explicitement sur la fenêtre.
 *
 * Les clics du bouton et de la fenêtre ne remontent pas : sur la carte
 * retournable, un clic la fait basculer.
 */
export function BiographieIntervenant({
  bio,
  limite,
  nom,
  sousTitre,
  photoUrl,
  initiales,
  langue: langueBrute,
  classeExtrait,
  classeBouton,
}: {
  bio: string;
  /** Longueur de l'extrait, en caractères. */
  limite: number;
  nom: string;
  /** Fonction et organisation, sous le nom dans la fenêtre. */
  sousTitre?: string | null;
  photoUrl?: string | null;
  initiales: string;
  langue: string;
  classeExtrait?: string;
  classeBouton?: string;
}) {
  const langue = lireLangue(langueBrute);
  const refFenetre = useRef<HTMLDialogElement>(null);
  const idTitre = useId();
  const [ouverte, setOuverte] = useState(false);
  const { extrait, tronquee } = extraitBiographie(bio, limite);

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

  function ouvrir(evenement: MouseEvent) {
    evenement.stopPropagation();
    setOuverte(true);
    refFenetre.current?.showModal();
  }

  const fermer = () => refFenetre.current?.close();

  return (
    <>
      <p className={classeExtrait}>{extrait}</p>
      {tronquee && (
        <>
          <button
            type="button"
            onClick={ouvrir}
            aria-haspopup="dialog"
            aria-label={selon(langue, {
              fr: `Lire la biographie de ${nom}`,
              en: `Read ${nom}'s biography`,
              pt: `Ler a biografia de ${nom}`,
            })}
            className={classeBouton}
          >
            <BookOpen aria-hidden size={15} />
            {selon(langue, {
              fr: "Lire la biographie",
              en: "Read the biography",
              pt: "Ler a biografia",
            })}
          </button>

          <dialog
            ref={refFenetre}
            aria-labelledby={idTitre}
            onClose={() => setOuverte(false)}
            onClick={(evenement) => {
              evenement.stopPropagation();
              // Clic sur le voile (hors du panneau) : fermeture.
              if (evenement.target === refFenetre.current) fermer();
            }}
            className="bg-bg text-text m-auto w-[min(100%-2rem,42rem)] max-w-none rounded-2xl p-0 text-left text-base font-normal tracking-normal normal-case shadow-2xl backdrop:bg-[#050f23]/65 backdrop:backdrop-blur-sm"
          >
            {ouverte && (
              <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-7">
                <div className="mb-5 flex items-start gap-4">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- servie par une route dédiée, hors optimiseur
                    <img
                      src={photoUrl}
                      alt=""
                      className="border-border h-20 w-20 shrink-0 rounded-full border object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="bg-blue-soft text-blue-text font-display grid h-20 w-20 shrink-0 place-items-center rounded-full text-xl font-bold"
                    >
                      {initiales}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2
                      id={idTitre}
                      className="text-heading font-display text-xl leading-snug font-semibold"
                    >
                      {nom}
                    </h2>
                    {sousTitre && <p className="text-text-3 mt-1 text-sm">{sousTitre}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={fermer}
                    aria-label={selon(langue, { fr: "Fermer", en: "Close", pt: "Fechar" })}
                    className="text-text-2 hover:bg-surface-2 hover:text-heading shrink-0 rounded-lg p-2"
                  >
                    <X aria-hidden size={20} />
                  </button>
                </div>
                <p className="text-text-2 text-[0.95rem] leading-relaxed whitespace-pre-line">
                  {bio.trim()}
                </p>
              </div>
            )}
          </dialog>
        </>
      )}
    </>
  );
}
