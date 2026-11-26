"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Maximize2,
  Minimize2,
  SquareArrowOutUpRight,
  X,
} from "lucide-react";

export interface TextesApercu {
  titre: string;
  telecharger: string;
  agrandir: string;
  reduire: string;
  ouvrir: string;
  fermer: string;
  afficher: string;
  mobile: string;
  cadre: string;
}

const BOUTON =
  "border-border text-heading hover:border-link hover:text-link inline-flex items-center gap-1.5 rounded-lg border bg-surface px-3 py-2 text-sm font-semibold transition-colors";

/**
 * Visionneuse du fichier de synthèse d'une newsletter (26 novembre 2026).
 *
 * Le PDF s'affiche dans la **visionneuse du navigateur**, dans un cadre : elle
 * apporte déjà le défilement des pages, le zoom, la recherche et l'impression,
 * et la refaire en JavaScript (pdf.js) ajouterait plusieurs centaines de Ko à
 * la page pour un résultat moins bon. Autour, la barre du portail : télécharger
 * (compté), agrandir en plein écran, ouvrir dans un onglet, fermer l'aperçu.
 *
 * Sur téléphone, les navigateurs n'affichent pas un PDF dans un cadre — Chrome
 * pour Android montre un cadre vide. L'aperçu y est remplacé par un message,
 * et le bouton de téléchargement reste.
 */
export function ApercuPdf({
  urlApercu,
  urlTelechargement,
  nomFichier,
  poids,
  textes,
}: {
  urlApercu: string;
  urlTelechargement: string;
  nomFichier: string;
  poids: string;
  textes: TextesApercu;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const [ouvert, setOuvert] = useState(true);
  const [pleinEcran, setPleinEcran] = useState(false);

  useEffect(() => {
    const suivre = () => setPleinEcran(document.fullscreenElement === conteneur.current);
    document.addEventListener("fullscreenchange", suivre);
    return () => document.removeEventListener("fullscreenchange", suivre);
  }, []);

  async function basculerPleinEcran() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await conteneur.current?.requestFullscreen();
    } catch {
      // Plein écran refusé (navigateur, iframe) : l'onglet fait l'affaire.
      window.open(urlApercu, "_blank", "noopener");
    }
  }

  return (
    <div
      ref={conteneur}
      className="border-border bg-surface flex flex-col overflow-hidden rounded-xl border"
    >
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <FileText aria-hidden size={18} className="text-link shrink-0" />
          <div className="min-w-0">
            <p className="text-heading text-sm font-semibold">{textes.titre}</p>
            <p className="text-text-3 truncate text-xs">
              {nomFichier}
              {poids ? ` · ${poids}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a href={urlTelechargement} className={BOUTON}>
            <Download aria-hidden size={15} />
            {textes.telecharger}
          </a>
          {ouvert && (
            <>
              <button
                type="button"
                onClick={basculerPleinEcran}
                className={`${BOUTON} hidden md:inline-flex`}
              >
                {pleinEcran ? (
                  <Minimize2 aria-hidden size={15} />
                ) : (
                  <Maximize2 aria-hidden size={15} />
                )}
                {pleinEcran ? textes.reduire : textes.agrandir}
              </button>
              <a
                href={urlApercu}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BOUTON} hidden md:inline-flex`}
              >
                <SquareArrowOutUpRight aria-hidden size={15} />
                {textes.ouvrir}
              </a>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              setOuvert((avant) => !avant);
            }}
            aria-expanded={ouvert}
            className={`${BOUTON} hidden md:inline-flex`}
          >
            {ouvert ? <X aria-hidden size={15} /> : <Eye aria-hidden size={15} />}
            {ouvert ? textes.fermer : textes.afficher}
          </button>
        </div>
      </div>

      {ouvert && (
        <iframe
          src={`${urlApercu}#view=FitH`}
          title={textes.cadre}
          className={`hidden w-full bg-neutral-700 md:block ${pleinEcran ? "flex-1" : "h-[80vh]"}`}
        />
      )}
      <p className="text-text-3 px-4 py-3 text-sm md:hidden">{textes.mobile}</p>
    </div>
  );
}
