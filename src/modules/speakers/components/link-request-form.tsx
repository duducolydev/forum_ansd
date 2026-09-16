"use client";
import { Mail } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

import { useActionState } from "react";
import { demanderLienAction, type ActionState } from "../actions";

const initialState: ActionState = {};

/**
 * Demande d'un lien d'accès intervenant.
 *
 * Le message de confirmation est volontairement conditionnel — « si cette
 * adresse correspond à un intervenant » : le formulaire ne doit pas devenir un
 * moyen de savoir qui figure au programme avant l'annonce officielle.
 */
export function LinkRequestForm() {
  const [state, formAction, pending] = useActionState(demanderLienAction, initialState);

  return (
    <form action={formAction} className="border-border bg-surface rounded-xl border p-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-text-3 text-xs font-semibold">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="border-border bg-bg text-text w-full rounded-lg border px-3 py-2.5 text-sm"
        />
      </div>

      <BoutonSite
        type="submit"
        disabled={pending}
        ton="principal"
        taille="compact"
        icone={Mail}
        className="mt-4 w-full"
      >
        {pending ? "Envoi…" : "Recevoir mon lien d'accès"}
      </BoutonSite>

      {state.error && <p className="text-danger-text mt-3 text-sm">{state.error}</p>}
      {state.message && !state.error && (
        <p role="status" className="text-text-2 mt-3 text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
