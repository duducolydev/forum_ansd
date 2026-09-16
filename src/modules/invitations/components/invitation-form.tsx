"use client";

import { useActionState } from "react";
import { createInvitationAction, type ActionState } from "../actions";
import { MailPlus } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

export function InvitationForm({ categories }: { categories: { id: string; labelFr: string }[] }) {
  const [state, formAction, pending] = useActionState(createInvitationAction, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
      <Field label="Prénom" name="firstName" required />
      <Field label="Nom" name="lastName" required />
      <Field label="E-mail" name="email" type="email" required />
      <Field label="Organisation" name="organization" />
      <Field label="Pays" name="country" />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="categoryId" className="text-heading text-sm font-semibold">
          Catégorie
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        >
          <option value="" disabled selected>
            Choisir…
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.labelFr}
            </option>
          ))}
        </select>
      </div>

      {state.error && <p className="text-danger-text text-sm md:col-span-2">{state.error}</p>}

      <div className="md:col-span-2">
        <Bouton ton="principal" icone={MailPlus} type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer l'invitation"}
        </Bouton>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
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
        className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
      />
    </div>
  );
}
