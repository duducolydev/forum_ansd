"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { EditeurTexteRiche } from "@/components/ui/editeur-texte-riche";
import { saveContentBlockAction, type ActionState } from "../actions";
import type { Langue } from "@/lib/langue";

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
  valuePt,
}: {
  contentKey: string;
  label: string;
  riche: boolean;
  max: number;
  valueFr: string;
  valueEn: string;
  valuePt: string;
}) {
  const [state, formAction, pending] = useActionState(saveContentBlockAction, initialState);

  const champ = (langue: Langue) => {
    const id = `${contentKey}-${langue}`;
    const intitule = {
      fr: "Français",
      en: "English (repli FR si vide)",
      pt: "Português (repli EN si vide)",
    }[langue];
    const valeur = { fr: valueFr, en: valueEn, pt: valuePt }[langue];
    const nom = { fr: "valueFr", en: "valueEn", pt: "valuePt" }[langue];

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
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        {champ("fr")}
        {champ("en")}
        {champ("pt")}
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
