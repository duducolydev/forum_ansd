"use client";

import { useActionState, useState } from "react";
import { requestDeletionAction, type MySpaceState } from "../my-space-actions";
import { AlertCircle, CircleCheck, Trash2, X } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

const initialState: MySpaceState = {};

export function DeletionRequest() {
  const [state, formAction, pending] = useActionState(requestDeletionAction, initialState);
  const [open, setOpen] = useState(false);

  if (state.success) {
    return (
      <p className="text-accent-text flex items-start gap-2 text-sm">
        <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0" />
        {state.success}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-3 text-sm">
        Conformément à la loi n°&nbsp;2008-12 sur la protection des données à caractère personnel,
        vous pouvez demander la suppression de vos données. La demande est enregistrée puis traitée
        par le comité d&apos;organisation.
      </p>

      {!open ? (
        <BoutonSite
          type="button"
          onClick={() => setOpen(true)}
          taille="compact"
          icone={Trash2}
          className="w-fit"
        >
          Demander la suppression de mes données
        </BoutonSite>
      ) : (
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm" className="text-heading text-sm font-semibold">
              Saisissez <code>SUPPRIMER</code> pour confirmer
            </label>
            <input
              id="confirm"
              name="confirm"
              required
              className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="transition-tout inline-flex w-fit items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            <Trash2 aria-hidden size={16} strokeWidth={2.2} />
            {pending ? "Envoi…" : "Confirmer la demande"}
          </button>
          <BoutonSite
            type="button"
            onClick={() => setOpen(false)}
            ton="discret"
            taille="compact"
            icone={X}
          >
            Annuler
          </BoutonSite>
        </form>
      )}

      {state.error && (
        <p className="flex items-start gap-2 text-sm text-red-600">
          <AlertCircle aria-hidden size={15} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
    </div>
  );
}
