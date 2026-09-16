"use client";

import { useActionState } from "react";
import { confirmEnrollAction, type EnrollState } from "./actions";
import { ShieldCheck } from "lucide-react";
import { Bouton } from "@/components/ui/bouton";

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
      <Bouton ton="principal" icone={ShieldCheck} type="submit" disabled={pending}>
        {pending ? "Vérification…" : "Activer"}
      </Bouton>
    </form>
  );
}
