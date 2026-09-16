"use client";

import { useActionState } from "react";
import { sendRemindersAction, type ActionState } from "../actions";
import { Send } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

const initialState: ActionState = {};

export function ReminderForm({ categories }: { categories: { id: string; labelFr: string }[] }) {
  const [state, formAction, pending] = useActionState(sendRemindersAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="reminder-category" className="text-text-3 text-xs font-semibold">
          Catégorie
        </label>
        <select
          id="reminder-category"
          name="categoryId"
          className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">Toutes</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.labelFr}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reminder-country" className="text-text-3 text-xs font-semibold">
          Pays
        </label>
        <input
          id="reminder-country"
          name="country"
          placeholder="Tous"
          className="border-border bg-surface text-text rounded-lg border px-3 py-2 text-sm"
        />
      </div>
      <Bouton ton="secondaire" icone={Send} type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Relancer les non-répondants (max 3)"}
      </Bouton>
      {state.success && <span className="text-accent-text text-sm">{state.success}</span>}
      {state.error && <span className="text-danger-text text-sm">{state.error}</span>}
    </form>
  );
}
