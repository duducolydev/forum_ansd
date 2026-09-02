"use client";

import { useActionState } from "react";
import { confirmEnrollAction, type EnrollState } from "./actions";

const initialState: EnrollState = {};

export function EnrollForm({ secret }: { secret: string }) {
  const [state, formAction, pending] = useActionState(confirmEnrollAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <input type="hidden" name="secret" value={secret} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-heading text-sm font-semibold">
          Code à 6 chiffres
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5 text-center text-lg tracking-[0.3em]"
        />
      </div>
      {state.error && <p className="text-danger-text text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-text hover:bg-primary-hover rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
      >
        {pending ? "Vérification…" : "Activer"}
      </button>
    </form>
  );
}
