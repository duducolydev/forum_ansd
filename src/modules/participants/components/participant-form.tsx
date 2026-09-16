"use client";

import { Save } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

import { useActionState } from "react";
import type { ActionState } from "../actions";
import type { ParticipantInput } from "../schema";

interface Props {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  categories: { id: string; labelFr: string }[];
  delegations: { id: string; name: string }[];
  defaultValues?: Partial<ParticipantInput>;
  submitLabel: string;
}

const initialState: ActionState = {};

export function ParticipantForm({
  action,
  categories,
  delegations,
  defaultValues,
  submitLabel,
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const d = defaultValues ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <Field label="Civilité" name="civility" defaultValue={d.civility} />
        <Field label="Prénom" name="firstName" defaultValue={d.firstName} required />
        <Field label="Nom" name="lastName" defaultValue={d.lastName} required />
        <Field label="E-mail" name="email" type="email" defaultValue={d.email} required />
        <Field label="Téléphone" name="phone" defaultValue={d.phone} />
        <Field label="Organisation" name="organization" defaultValue={d.organization} />
        <Field
          label="Type d'organisation"
          name="organizationType"
          defaultValue={d.organizationType}
        />
        <Field label="Fonction" name="jobTitle" defaultValue={d.jobTitle} />
        <Field label="Pays" name="country" defaultValue={d.country} required />
        <Field label="Ville" name="city" defaultValue={d.city} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="categoryId" className="text-heading text-sm font-semibold">
            Catégorie
          </label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={d.categoryId}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          >
            <option value="" disabled>
              Choisir…
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.labelFr}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="delegationId" className="text-heading text-sm font-semibold">
            Délégation
          </label>
          <select
            id="delegationId"
            name="delegationId"
            defaultValue={d.delegationId ?? ""}
            className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
          >
            <option value="">Aucune</option>
            {delegations.map((delegation) => (
              <option key={delegation.id} value={delegation.id}>
                {delegation.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-heading text-sm font-semibold">
          Notes internes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={d.notes}
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        />
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

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-heading text-sm font-semibold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
      />
    </div>
  );
}
