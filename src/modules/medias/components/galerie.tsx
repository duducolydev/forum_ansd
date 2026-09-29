"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Film, Newspaper, Play, X } from "lucide-react";
import type { ElementGalerie } from "../service";

/**
 * Galerie publique et sa visionneuse plein écran.
 *
 * `<dialog>` natif : focus piégé, touche Échap et retour du focus à la
 * vignette sont assurés par le navigateur. Flèches du clavier et balayage sur
 * téléphone pour passer d'un élément à l'autre. Le lecteur vidéo n'est chargé
 * qu'à l'ouverture : aucune requête vers YouTube ou Vimeo tant que le
 * visiteur n'a rien demandé.
 */
export function Galerie({ elements, en }: { elements: ElementGalerie[]; en: boolean }) {
  const fenetre = useRef<HTMLDialogElement>(null);
  const [rang, setRang] = useState<number | null>(null);
  const depart = useRef<number | null>(null);
  const courant = rang === null ? null : elements[rang];

  const ouvrir = (index: number) => {
    setRang(index);
    fenetre.current?.showModal();
  };
  const fermer = () => fenetre.current?.close();
  const aller = useCallback(
    (sens: number) =>
      setRang((actuel) =>
        actuel === null ? null : (actuel + sens + elements.length) % elements.length,
      ),
    [elements.length],
  );

  useEffect(() => {
    if (rang === null) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === "ArrowRight") aller(1);
      if (evenement.key === "ArrowLeft") aller(-1);
    };
    window.addEventListener("keydown", surTouche);
    const racine = document.documentElement;
    const avant = racine.style.overflow;
    racine.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", surTouche);
      racine.style.overflow = avant;
    };
  }, [rang, aller]);

  if (elements.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {elements.map((element, index) => (
          <li key={element.id}>
            <button
              type="button"
              onClick={() => ouvrir(index)}
              className="group border-border bg-bg-3 relative block aspect-[4/3] w-full overflow-hidden rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
              aria-label={`${element.type === "video" ? (en ? "Play video" : "Lire la vidéo") : en ? "Enlarge photo" : "Agrandir la photo"}${element.legende ? ` : ${element.legende}` : ""}`}
            >
              {/* Pictogramme de repli, sous la vignette : il reste visible si
                  elle manque ou ne charge pas (fournisseur injoignable). */}
              <span aria-hidden className="text-text-3 absolute inset-0 grid place-items-center">
                <Film size={32} />
              </span>
              {element.vignette && (
                /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée */
                <img
                  src={element.vignette}
                  alt=""
                  loading="lazy"
                  onError={(evenement) => {
                    evenement.currentTarget.hidden = true;
                  }}
                  className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
              )}
              {element.type === "video" && (
                <span
                  aria-hidden
                  className="absolute inset-0 grid place-items-center bg-black/15 transition-colors group-hover:bg-black/30"
                >
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/90 text-[var(--deep)] shadow-lg transition-transform group-hover:scale-110">
                    <Play size={24} className="ml-1" fill="currentColor" />
                  </span>
                </span>
              )}
              {element.legende && (
                <span className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/75 to-transparent px-3 pt-6 pb-2.5 text-left text-xs font-medium text-white transition-transform duration-300 group-hover:translate-y-0 group-focus-visible:translate-y-0">
                  {element.legende}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={fenetre}
        onClose={() => setRang(null)}
        onClick={(evenement) => {
          if (evenement.target === fenetre.current) fermer();
        }}
        aria-label={en ? "Media viewer" : "Visionneuse"}
        className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-[#050d1c]/95 backdrop:backdrop-blur-md"
      >
        {courant && (
          <div
            className="flex h-full flex-col text-white"
            onPointerDown={(evenement) => {
              depart.current = evenement.clientX;
            }}
            onPointerUp={(evenement) => {
              if (depart.current === null) return;
              const ecart = evenement.clientX - depart.current;
              depart.current = null;
              if (Math.abs(ecart) > 60) aller(ecart < 0 ? 1 : -1);
            }}
          >
            <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
              <span className="text-sm text-white/75 tabular-nums">
                {(rang ?? 0) + 1} / {elements.length}
              </span>
              <button
                type="button"
                onClick={fermer}
                aria-label={en ? "Close" : "Fermer"}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
              >
                <X aria-hidden size={22} />
              </button>
            </div>

            <div
              className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
              onClick={(evenement) => {
                if (evenement.target === evenement.currentTarget) fermer();
              }}
            >
              {courant.type === "video" && courant.lecteur ? (
                <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-black shadow-2xl">
                  <iframe
                    key={courant.id}
                    src={courant.lecteur}
                    title={courant.legende || (en ? "Video" : "Vidéo")}
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="h-full w-full"
                  />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element -- servie par une route contrôlée */
                <img
                  key={courant.id}
                  src={courant.image ?? courant.vignette ?? ""}
                  alt={courant.legende}
                  width={courant.largeur ?? undefined}
                  height={courant.hauteur ?? undefined}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-2xl select-none"
                  draggable={false}
                />
              )}

              {elements.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => aller(-1)}
                    aria-label={en ? "Previous" : "Précédent"}
                    className="absolute left-2 hidden h-12 w-12 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/25 sm:grid"
                  >
                    <ChevronLeft aria-hidden size={26} />
                  </button>
                  <button
                    type="button"
                    onClick={() => aller(1)}
                    aria-label={en ? "Next" : "Suivant"}
                    className="absolute right-2 hidden h-12 w-12 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/25 sm:grid"
                  >
                    <ChevronRight aria-hidden size={26} />
                  </button>
                </>
              )}
            </div>

            <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-1.5 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
              {courant.legende && <p className="text-base">{courant.legende}</p>}
              <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/70">
                {courant.credit && <span>© {courant.credit}</span>}
                {courant.source && (
                  <Link
                    href={courant.source.href}
                    className="inline-flex items-center gap-1.5 text-white underline underline-offset-4"
                  >
                    <Newspaper aria-hidden size={14} />
                    {en ? "Read the article" : "Lire l'article"}
                  </Link>
                )}
                {courant.pageVideo && (
                  <a
                    href={courant.pageVideo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-white underline underline-offset-4"
                  >
                    <ExternalLink aria-hidden size={14} />
                    {courant.pageVideo.includes("vimeo")
                      ? en
                        ? "Watch on Vimeo"
                        : "Voir sur Vimeo"
                      : en
                        ? "Watch on YouTube"
                        : "Voir sur YouTube"}
                  </a>
                )}
              </p>
              {elements.length > 1 && (
                <div className="mt-1 flex gap-3 sm:hidden">
                  <button
                    type="button"
                    onClick={() => aller(-1)}
                    aria-label={en ? "Previous" : "Précédent"}
                    className="grid h-11 w-11 place-items-center rounded-full bg-white/10"
                  >
                    <ChevronLeft aria-hidden size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => aller(1)}
                    aria-label={en ? "Next" : "Suivant"}
                    className="grid h-11 w-11 place-items-center rounded-full bg-white/10"
                  >
                    <ChevronRight aria-hidden size={22} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
