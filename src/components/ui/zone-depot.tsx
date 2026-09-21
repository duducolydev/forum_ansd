"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { FileUp, X, type LucideIcon } from "lucide-react";

/**
 * Zone de dépôt de fichier, partagée par tout le BackOffice (PLAN.md §26).
 *
 * Elle remplace les `<input type="file">` nus, qui n'annonçaient ni les formats
 * acceptés, ni le poids maximal, ni le fichier retenu — trois informations que
 * la personne n'avait qu'après le refus du serveur.
 *
 * Le champ reste un vrai `<input type="file">`, simplement masqué à l'œil et non
 * au clavier ni aux lecteurs d'écran (`sr-only`) : le formulaire l'envoie comme
 * avant, la tabulation l'atteint, et les parcours de test qui le visent par son
 * nom continuent de fonctionner. Le glisser-déposer se contente de **poser les
 * fichiers dans ce champ**, puis de déclencher son `change` : un seul chemin
 * d'entrée, donc un seul comportement à vérifier.
 */

export interface ProprietesZoneDepot {
  id?: string;
  name: string;
  /** Nom accessible du champ : c'est lui qu'annonce un lecteur d'écran. */
  libelle: string;
  /** Deuxième ligne : formats acceptés et poids maximal, en clair. */
  aide?: string;
  accept?: string;
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  /** Icône de la zone. Par défaut, un document qui monte. */
  icone?: LucideIcon;
  /** Invite principale, quand « Glissez un fichier… » ne convient pas. */
  invite?: string;
  /** Aperçu ou complément affiché **au-dessus** de la zone (image, fichier en place). */
  entete?: ReactNode;
  /** Complément affiché **sous** la zone (légende, erreur…). */
  children?: ReactNode;
  onChange?: (evenement: ChangeEvent<HTMLInputElement>) => void;
  /**
   * Accès au champ lui-même, pour les écrans qui doivent le relire ou en
   * remplacer le contenu — l'illustration d'une section, par exemple, y repose
   * une version réduite de l'image avant l'envoi.
   */
  champRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

/** Poids lisible : « 2,4 Mo » plutôt que « 2517372 ». */
function poidsLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

export function ZoneDepot({
  id,
  name,
  libelle,
  aide,
  accept,
  multiple = false,
  required = false,
  disabled = false,
  icone: Icone = FileUp,
  invite,
  entete,
  children,
  onChange,
  champRef,
  className = "",
}: ProprietesZoneDepot) {
  const idAuto = useId();
  const idChamp = id ?? `depot-${idAuto}`;
  const interne = useRef<HTMLInputElement>(null);
  const champ = champRef ?? interne;
  const [glisse, setGlisse] = useState(false);
  const [retenus, setRetenus] = useState<{ nom: string; poids: number }[]>([]);

  function memoriser(fichiers: FileList | null) {
    setRetenus(
      Array.from(fichiers ?? []).map((fichier) => ({ nom: fichier.name, poids: fichier.size })),
    );
  }

  function surDepot(evenement: DragEvent<HTMLLabelElement>) {
    evenement.preventDefault();
    setGlisse(false);
    if (disabled || !champ.current) return;

    const fichiers = evenement.dataTransfer.files;
    if (fichiers.length === 0) return;

    // Un champ fichier n'accepte qu'un `DataTransfer` : on reconstruit la liste
    // (limitée au premier fichier hors mode multiple, comme le ferait le
    // sélecteur du système).
    const transfert = new DataTransfer();
    for (const fichier of Array.from(fichiers).slice(0, multiple ? undefined : 1)) {
      transfert.items.add(fichier);
    }
    champ.current.files = transfert.files;
    // `change` ne part pas tout seul quand la liste est posée par le code :
    // sans lui, les écrans qui réagissent au choix d'un fichier resteraient muets.
    champ.current.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {entete}

      <label
        htmlFor={idChamp}
        onDragOver={(evenement) => {
          evenement.preventDefault();
          if (!disabled) setGlisse(true);
        }}
        onDragLeave={() => setGlisse(false)}
        onDrop={surDepot}
        className={`group hover:border-link hover:bg-blue-soft/40 flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ansd-or)] ${
          glisse ? "border-link bg-blue-soft" : "border-border bg-bg-2"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <span
          aria-hidden
          className={`text-link grid h-10 w-10 place-items-center rounded-full shadow-sm transition-colors ${glisse ? "bg-white" : "bg-surface"}`}
        >
          <Icone size={19} strokeWidth={2.1} />
        </span>

        <span className="text-heading text-sm font-semibold">
          {invite ?? (multiple ? "Glissez des fichiers ici" : "Glissez un fichier ici")}
          <span className="text-link"> ou parcourez</span>
        </span>

        {aide && <span className="text-text-3 text-xs">{aide}</span>}

        <input
          ref={champ}
          id={idChamp}
          name={name}
          type="file"
          accept={accept}
          multiple={multiple}
          required={required}
          disabled={disabled}
          aria-label={libelle}
          className="sr-only"
          onChange={(evenement) => {
            memoriser(evenement.target.files);
            onChange?.(evenement);
          }}
        />
      </label>

      {retenus.length > 0 && (
        <ul className="flex flex-col gap-1">
          {retenus.map((fichier) => (
            <li
              key={fichier.nom}
              className="border-border bg-surface text-text-2 flex items-center justify-between gap-3 rounded-lg border px-3 py-1.5 text-xs"
            >
              <span className="truncate font-medium">{fichier.nom}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-text-3">{poidsLisible(fichier.poids)}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (champ.current) champ.current.value = "";
                    setRetenus([]);
                  }}
                  className="text-text-3 hover:text-danger-text rounded transition-colors"
                  aria-label={`Retirer ${fichier.nom}`}
                  title="Retirer"
                >
                  <X aria-hidden size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {children}
    </div>
  );
}
