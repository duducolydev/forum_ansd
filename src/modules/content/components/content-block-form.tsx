"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { EditeurTexteRiche } from "@/components/ui/editeur-texte-riche";
import { saveContentBlockAction, type ActionState } from "../actions";

const initialState: ActionState = {};

/**
 * Une zone éditoriale du site public (brief §5.11).
 *
 * Les zones de texte s'écrivent avec **le même éditeur que les sections**
 * (§26) : gras, listes, liens. Les titres font exception — ils sortent dans un
 * `<h1>`, où une liste n'aurait aucun sens —, et gardent un champ simple. C'est
 * la clé qui décide (`keys.ts`), pas le formulaire.
 */
export function ContentBlockForm({
  contentKey,
  label,
  riche,
  max,
  valueFr,
  valueEn,
}: {
  contentKey: string;
  label: string;
  riche: boolean;
  max: number;
  valueFr: string;
  valueEn: string;
}) {
  const [state, formAction, pending] = useActionState(saveContentBlockAction, initialState);

  const champ = (langue: "fr" | "en") => {
    const id = `${contentKey}-${langue}`;
    const intitule = langue === "fr" ? "Français" : "English (repli FR si vide)";
    const valeur = langue === "fr" ? valueFr : valueEn;
    const nom = langue === "fr" ? "valueFr" : "valueEn";

    return (
      <div className="flex flex-col gap-1.5">
        <label id={`${id}-label`} htmlFor={id} className="text-text-3 text-xs font-semibold">
          {intitule}
        </label>
        {riche ? (
          <EditeurTexteRiche
            id={id}
            name={nom}
            labelId={`${id}-label`}
            libelle={`${label} — ${intitule}`}
            valeurInitiale={valeur}
            max={max}
          />
        ) : (
          <textarea
            id={id}
            name={nom}
            rows={2}
            maxLength={max}
            defaultValue={valeur}
            className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm"
          />
        )}
      </div>
    );
  };

  return (
    <form
      action={formAction}
      data-testid="bloc-contenu"
      data-cle={contentKey}
      className="border-border bg-surface rounded-xl border p-5"
    >
      <input type="hidden" name="key" value={contentKey} />
      <h3 className="text-heading mb-3 text-sm font-semibold">{label}</h3>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {champ("fr")}
        {champ("en")}
      </div>
      {state.error && <p className="text-danger-text mt-2 text-sm">{state.error}</p>}
      {state.message && !state.error && (
        <p role="status" className="text-accent-text mt-2 text-sm">
          {state.message}
        </p>
      )}
      <Bouton ton="principal" icone={Save} type="submit" disabled={pending} className="mt-3">
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Bouton>
    </form>
  );
}
