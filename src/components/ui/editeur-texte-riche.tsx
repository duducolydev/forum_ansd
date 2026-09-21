"use client";

import { useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  CornerDownLeft,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  RemoveFormatting,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import {
  lienAutorise,
  lireTexteRiche,
  nettoyerDoc,
  serialiserTexteRiche,
  texteBrut,
} from "@/lib/texte-riche";

/**
 * Éditeur de texte mis en forme, partagé par le BackOffice (PLAN.md §17, §26).
 *
 * Il sert aux sections de page, aux zones éditoriales et aux actualités : la
 * même barre d'outils, les mêmes limites, le même document en sortie — une
 * personne qui a appris à écrire une section sait écrire une actualité.
 *
 * Ce qu'il permet est exactement ce que le site sait afficher : gras, italique,
 * souligné, listes, liens et sauts de ligne. Les titres, citations et blocs de
 * code sont désactivés — collés depuis un document, ils redeviennent du texte.
 *
 * La valeur part dans un champ caché, sous la forme du document structuré déjà
 * nettoyé : le formulaire de la section l'envoie avec le reste, au même
 * « Enregistrer ». Le serveur la nettoie de nouveau, parce qu'un champ caché se
 * falsifie.
 */

const BOUTON_OUTIL =
  "text-text-2 hover:bg-bg-2 hover:text-heading aria-pressed:bg-blue-soft aria-pressed:text-blue-text grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-40";

function Outil({
  libelle,
  actif,
  desactive,
  onClick,
  children,
}: {
  libelle: string;
  actif?: boolean;
  desactive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={libelle}
      aria-label={libelle}
      aria-pressed={actif === undefined ? undefined : actif}
      disabled={desactive}
      // `mousedown` empêché : le clic ne doit pas retirer la sélection à
      // l'éditeur avant que la commande ne s'applique.
      onMouseDown={(evenement) => evenement.preventDefault()}
      onClick={onClick}
      className={BOUTON_OUTIL}
    >
      {children}
    </button>
  );
}

function BarreOutils({
  editor,
  libelle,
  surLien,
}: {
  editor: Editor;
  libelle: string;
  surLien: () => void;
}) {
  const etat = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      gras: e.isActive("bold"),
      italique: e.isActive("italic"),
      souligne: e.isActive("underline"),
      puces: e.isActive("bulletList"),
      numeros: e.isActive("orderedList"),
      lien: e.isActive("link"),
      annuler: e.can().undo(),
      retablir: e.can().redo(),
    }),
  });

  const commande = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label={`Mise en forme — ${libelle}`}
      className="border-border bg-surface-2 flex flex-wrap items-center gap-0.5 rounded-t-lg border border-b-0 px-1.5 py-1"
    >
      <Outil libelle="Gras" actif={etat.gras} onClick={() => commande().toggleBold().run()}>
        <Bold aria-hidden size={15} strokeWidth={2.4} />
      </Outil>
      <Outil
        libelle="Italique"
        actif={etat.italique}
        onClick={() => commande().toggleItalic().run()}
      >
        <Italic aria-hidden size={15} strokeWidth={2.4} />
      </Outil>
      <Outil
        libelle="Souligné"
        actif={etat.souligne}
        onClick={() => commande().toggleUnderline().run()}
      >
        <Underline aria-hidden size={15} strokeWidth={2.4} />
      </Outil>

      <span aria-hidden className="bg-border mx-1 h-5 w-px" />

      <Outil
        libelle="Liste à puces"
        actif={etat.puces}
        onClick={() => commande().toggleBulletList().run()}
      >
        <List aria-hidden size={15} strokeWidth={2.4} />
      </Outil>
      <Outil
        libelle="Liste numérotée"
        actif={etat.numeros}
        onClick={() => commande().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden size={15} strokeWidth={2.4} />
      </Outil>
      <Outil libelle="Saut de ligne" onClick={() => commande().setHardBreak().run()}>
        <CornerDownLeft aria-hidden size={15} strokeWidth={2.4} />
      </Outil>

      <span aria-hidden className="bg-border mx-1 h-5 w-px" />

      <Outil libelle="Lien" actif={etat.lien} onClick={surLien}>
        <Link2 aria-hidden size={15} strokeWidth={2.4} />
      </Outil>
      <Outil
        libelle="Retirer le lien"
        desactive={!etat.lien}
        onClick={() => commande().extendMarkRange("link").unsetLink().run()}
      >
        <Unlink aria-hidden size={15} strokeWidth={2.4} />
      </Outil>
      <Outil
        libelle="Effacer la mise en forme"
        onClick={() => commande().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting aria-hidden size={15} strokeWidth={2.4} />
      </Outil>

      <span aria-hidden className="bg-border mx-1 h-5 w-px" />

      <Outil libelle="Annuler" desactive={!etat.annuler} onClick={() => commande().undo().run()}>
        <Undo2 aria-hidden size={15} strokeWidth={2.4} />
      </Outil>
      <Outil libelle="Rétablir" desactive={!etat.retablir} onClick={() => commande().redo().run()}>
        <Redo2 aria-hidden size={15} strokeWidth={2.4} />
      </Outil>
    </div>
  );
}

export function EditeurTexteRiche({
  id,
  name,
  labelId,
  libelle,
  valeurInitiale,
  max,
}: {
  id: string;
  name: string;
  /** Identifiant de l'étiquette visible, qui nomme la zone d'édition. */
  labelId: string;
  libelle: string;
  valeurInitiale: string;
  max: number;
}) {
  const documentInitial = lireTexteRiche(valeurInitiale);
  // Sans rien écrire, la valeur envoyée est déjà la forme normalisée : un champ
  // non touché ne perd rien, même si l'éditeur n'a pas pu se charger.
  const [valeur, setValeur] = useState(() => serialiserTexteRiche(documentInitial));
  const [longueur, setLongueur] = useState(() => texteBrut(documentInitial).length);
  const [saisieLien, setSaisieLien] = useState<string | null>(null);
  const [erreurLien, setErreurLien] = useState<string | null>(null);

  const editor = useEditor({
    // Rendu côté client seulement : l'éditeur n'a pas d'équivalent serveur, et
    // le rendre au serveur produirait un écart d'hydratation.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          isAllowedUri: (url) => lienAutorise(url) !== null,
        },
      }),
    ],
    content:
      documentInitial.content.length > 0
        ? documentInitial
        : { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelId,
        class:
          "border-border bg-bg text-text min-h-[7.5rem] rounded-b-lg border px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ansd-or)] [&_a]:text-link [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:ps-5",
      },
    },
    onUpdate: ({ editor: e }) => {
      const doc = nettoyerDoc(e.getJSON());
      setValeur(serialiserTexteRiche(doc));
      setLongueur(texteBrut(doc).length);
    },
  });

  function appliquerLien() {
    if (!editor || saisieLien === null) return;
    const href = lienAutorise(saisieLien);
    if (!href) {
      setErreurLien("Adresse refusée : https://…, mailto:… ou un chemin commençant par /.");
      return;
    }
    const chaine = editor.chain().focus();
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // Rien de sélectionné : l'adresse devient le texte du lien.
      chaine.insertContent({
        type: "text",
        text: href,
        marks: [{ type: "link", attrs: { href } }],
      });
    } else {
      chaine.extendMarkRange("link").setLink({ href });
    }
    chaine.run();
    setSaisieLien(null);
    setErreurLien(null);
  }

  const trop = longueur > max;

  return (
    <div className="flex flex-col">
      <input type="hidden" name={name} value={valeur} />

      {editor ? (
        <BarreOutils
          editor={editor}
          libelle={libelle}
          surLien={() => {
            setErreurLien(null);
            setSaisieLien(String(editor.getAttributes("link").href ?? ""));
          }}
        />
      ) : (
        <div className="border-border bg-surface-2 h-10 rounded-t-lg border border-b-0" />
      )}

      {saisieLien !== null && (
        <div className="border-border bg-surface-2 flex flex-wrap items-center gap-2 border border-b-0 px-2 py-1.5">
          <input
            type="text"
            value={saisieLien}
            onChange={(evenement) => setSaisieLien(evenement.target.value)}
            onKeyDown={(evenement) => {
              if (evenement.key === "Enter") {
                evenement.preventDefault();
                appliquerLien();
              }
              if (evenement.key === "Escape") setSaisieLien(null);
            }}
            placeholder="https://… ou /programme"
            aria-label={`Adresse du lien — ${libelle}`}
            className="border-border bg-bg text-text min-w-[200px] flex-1 rounded-md border px-2 py-1 text-sm"
            autoFocus
          />
          <button
            type="button"
            onClick={appliquerLien}
            className="bg-primary text-primary-text rounded-md px-2.5 py-1 text-xs font-semibold"
          >
            Appliquer le lien
          </button>
          <button
            type="button"
            onClick={() => setSaisieLien(null)}
            className="text-text-2 rounded-md px-2 py-1 text-xs font-semibold"
          >
            Annuler
          </button>
          {erreurLien && (
            <span role="status" className="text-danger-text basis-full text-xs">
              {erreurLien}
            </span>
          )}
        </div>
      )}

      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div className="border-border bg-bg text-text-3 min-h-[7.5rem] rounded-b-lg border px-3 py-2.5 text-sm">
          Chargement de l&apos;éditeur…
        </div>
      )}

      <span
        className={`mt-1 text-end text-xs ${trop ? "text-danger-text font-semibold" : "text-text-3"}`}
        aria-live="polite"
      >
        {longueur} / {max} caractères{trop ? " — trop long, l'enregistrement sera refusé" : ""}
      </span>
    </div>
  );
}
