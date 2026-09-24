"use client";

import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";
import { SelectRecherche } from "@/components/ui/select-recherche";

import { useActionState } from "react";
import type { ActionState } from "../actions";
import type { DelegationInput } from "../schema";

/** Référent tel qu'il est proposé au rattachement : fiches en service seulement. */
export interface ReferentOption {
  id: string;
  name: string;
  email: string;
  role: string | null;
}

interface Props {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  defaultValues?: Partial<DelegationInput>;
  submitLabel: string;
  referents: ReferentOption[];
}

const initialState: ActionState = {};

export function DelegationForm({ action, defaultValues, submitLabel, referents }: Props) {
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

        {/*
          Référent interne (§28). La liste ne propose que les fiches en service :
          rattacher une délégation à quelqu'un qui a quitté le comité lui
          donnerait un guide injoignable, et l'alerte partirait dans le vide.
        */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="referentId" className="text-heading text-sm font-semibold">
            Référent
          </label>
          <SelectRecherche
            id="referentId"
            name="referentId"
            defaultValue={d.referentId ?? ""}
            labelVide="Aucun pour l'instant"
            placeholderRecherche="Nom, fonction ou adresse…"
            options={referents.map((referent) => ({
              value: referent.id,
              label: referent.role ? `${referent.name} — ${referent.role}` : referent.name,
              detail: referent.email,
            }))}
          />
          <span className="text-text-3 text-xs">
            {referents.length === 0
              ? "Aucun référent en service. Créez-en un depuis « Référents »."
              : "Il est prévenu par e-mail de sa désignation, puis de chaque nouveau membre."}
          </span>
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
