"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { AlignCenter, AlignLeft, AlignRight, ImagePlus, Trash2 } from "lucide-react";
import { ALIGNEMENTS_IMAGE, LARGEURS_IMAGE } from "@/lib/texte-riche";

/**
 * Barre des images du corps d'une newsletter (§34).
 *
 * Séparée de la barre de mise en forme, et posée **sous** elle : elle ne
 * s'applique pas au texte mais à un bloc, et les mélanger aurait donné une
 * rangée de quinze boutons dont la moitié grisée la plupart du temps.
 *
 * Les réglages d'alignement et de largeur n'apparaissent que lorsqu'une image
 * est sélectionnée. Avant cela, il n'y a rien à régler, et des boutons inertes
 * n'apprennent rien à personne.
 */

const BOUTON =
  "text-text-2 hover:bg-bg-2 hover:text-heading aria-pressed:bg-blue-soft aria-pressed:text-blue-text grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-40";

const ICONE_ALIGNEMENT = {
  gauche: AlignLeft,
  centre: AlignCenter,
  droite: AlignRight,
} as const;

const LIBELLE_ALIGNEMENT = {
  gauche: "Aligner à gauche",
  centre: "Centrer",
  droite: "Aligner à droite",
} as const;

export function BarreImages({
  editor,
  televerser,
  imageActive,
}: {
  editor: Editor;
  televerser: (fichier: File) => Promise<number | null>;
  /** Attributs de l'image sélectionnée, ou `null` si la sélection n'en est pas une. */
  imageActive: { alignement: string; largeur: number; alt: string } | null;
}) {
  const champFichier = useRef<HTMLInputElement>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function auChoixDuFichier(fichier: File | undefined) {
    if (!fichier) return;
    setEnCours(true);
    setErreur(null);
    try {
      const cle = await televerser(fichier);
      if (cle === null) {
        setErreur("L'image n'a pas pu être ajoutée.");
        return;
      }
      /*
       * L'image est insérée à l'endroit du curseur, puis un paragraphe vide
       * derrière : sans lui, une image en fin de document laisse l'utilisateur
       * sans endroit où continuer à écrire — le nœud est un atome, on n'entre
       * pas dedans.
       */
      editor
        .chain()
        .focus()
        .insertContent([
          { type: "image", attrs: { cle, alt: "", alignement: "centre", largeur: 100 } },
          { type: "paragraph" },
        ])
        .run();
    } finally {
      setEnCours(false);
      // Le champ est vidé : sans cela, rechoisir le même fichier ne déclenche
      // aucun événement, et l'utilisateur croit que rien ne se passe.
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  return (
    <div className="border-border bg-surface-2 flex flex-wrap items-center gap-1 border border-b-0 px-2 py-1.5">
      <input
        ref={champFichier}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(evenement) => void auChoixDuFichier(evenement.target.files?.[0])}
      />
      <button
        type="button"
        disabled={enCours}
        onClick={() => champFichier.current?.click()}
        className="text-text-2 hover:bg-bg-2 hover:text-heading flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold disabled:opacity-40"
      >
        <ImagePlus aria-hidden size={14} strokeWidth={2.4} />
        {enCours ? "Ajout…" : "Insérer une image"}
      </button>

      {imageActive && (
        <>
          <span aria-hidden className="bg-border mx-1 h-5 w-px" />

          {ALIGNEMENTS_IMAGE.map((alignement) => {
            const Icone = ICONE_ALIGNEMENT[alignement];
            return (
              <button
                key={alignement}
                type="button"
                title={LIBELLE_ALIGNEMENT[alignement]}
                aria-label={LIBELLE_ALIGNEMENT[alignement]}
                aria-pressed={imageActive.alignement === alignement}
                onClick={() =>
                  editor.chain().focus().updateAttributes("image", { alignement }).run()
                }
                className={BOUTON}
              >
                <Icone aria-hidden size={15} strokeWidth={2.4} />
              </button>
            );
          })}

          <span aria-hidden className="bg-border mx-1 h-5 w-px" />

          {LARGEURS_IMAGE.map((largeur) => (
            <button
              key={largeur}
              type="button"
              title={`Largeur ${largeur} %`}
              aria-label={`Largeur ${largeur} pour cent`}
              aria-pressed={imageActive.largeur === largeur}
              onClick={() => editor.chain().focus().updateAttributes("image", { largeur }).run()}
              className={`${BOUTON} w-auto px-2 text-xs font-semibold`}
            >
              {largeur} %
            </button>
          ))}

          <span aria-hidden className="bg-border mx-1 h-5 w-px" />

          <input
            type="text"
            value={imageActive.alt}
            onChange={(evenement) =>
              editor.chain().updateAttributes("image", { alt: evenement.target.value }).run()
            }
            placeholder="Décrire l'image"
            aria-label="Alternative textuelle de l'image"
            className="border-border bg-bg text-text min-w-[160px] flex-1 rounded-md border px-2 py-1 text-xs"
          />

          <button
            type="button"
            title="Retirer l'image du texte"
            aria-label="Retirer l'image du texte"
            onClick={() => editor.chain().focus().deleteSelection().run()}
            className={`${BOUTON} text-danger-text`}
          >
            <Trash2 aria-hidden size={15} strokeWidth={2.4} />
          </button>
        </>
      )}

      {erreur && (
        <span role="status" className="text-danger-text basis-full text-xs">
          {erreur}
        </span>
      )}

      {!imageActive && (
        <span className="text-text-3 ms-auto text-xs">
          Sélectionnez une image pour régler sa position et sa taille.
        </span>
      )}
    </div>
  );
}
