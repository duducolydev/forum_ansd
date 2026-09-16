"use client";

import { useActionState } from "react";
import { saveContentBlockAction, type ActionState } from "../actions";
import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

export function ContentBlockForm({
  contentKey,
  label,
  valueFr,
  valueEn,
}: {
  contentKey: string;
  label: string;
  valueFr: string;
  valueEn: string;
}) {
  const [state, formAction, pending] = useActionState(saveContentBlockAction, initialState);

  return (
    <form action={formAction} className="border-border bg-surface rounded-xl border p-5">
      <input type="hidden" name="key" value={contentKey} />
      <h3 className="text-heading mb-3 text-sm font-semibold">{label}</h3>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${contentKey}-fr`} className="text-text-3 text-xs font-semibold">
            Français
          </label>
          <textarea
            id={`${contentKey}-fr`}
            name="valueFr"
            rows={4}
            defaultValue={valueFr}
            className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${contentKey}-en`} className="text-text-3 text-xs font-semibold">
            English (repli FR si vide)
          </label>
          <textarea
            id={`${contentKey}-en`}
            name="valueEn"
            rows={4}
            defaultValue={valueEn}
            className="border-border bg-bg text-text rounded-lg border px-3 py-2.5 text-sm"
          />
        </div>
      </div>
      {state.error && <p className="text-danger-text mt-2 text-sm">{state.error}</p>}
      <Bouton
        ton="principal"
        icone={Save}
        type="submit"
        disabled={pending}

        className="mt-3"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Bouton>
    </form>
  );
}
