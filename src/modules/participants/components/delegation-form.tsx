"use client";

import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

import { useActionState } from "react";
import type { ActionState } from "../actions";
import type { DelegationInput } from "../schema";

interface Props {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<DelegationInput>;
  submitLabel: string;
}

const initialState: ActionState = {};

export function DelegationForm({ action, defaultValues, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const d = defaultValues ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-heading text-sm font-semibold">
          Nom de la délégation
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={d.name}
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        />
      </div>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="country" className="text-heading text-sm font-semibold">
            Pays
          </label>
          <input
            id="country"
            name="country"
            defaultValue={d.country}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="institution" className="text-heading text-sm font-semibold">
            Institution
          </label>
          <input
            id="institution"
            name="institution"
            defaultValue={d.institution}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="maxMembers" className="text-heading text-sm font-semibold">
            Effectif maximum
          </label>
          <input
            id="maxMembers"
            name="maxMembers"
            type="number"
            min={1}
            defaultValue={d.maxMembers}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          />
        </div>
      </div>

      {state.error && <p className="text-danger-text text-sm">{state.error}</p>}

      <div>
        <Bouton ton="principal" icone={Save} type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : submitLabel}
        </Bouton>
      </div>
    </form>
  );
}
