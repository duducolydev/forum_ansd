"use client";

import { useActionState, useState } from "react";
import { requestMagicLinkAction, verifyCodeAction, type MagicLinkState } from "../my-space-actions";
import { AlertCircle, KeyRound, Mail } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

const initialState: MagicLinkState = {};

export function MagicLinkForm({ linkError }: { linkError?: boolean }) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestMagicLinkAction,
    initialState,
  );
  const [codeState, codeAction, codePending] = useActionState(verifyCodeAction, initialState);
  const [email, setEmail] = useState("");

  const sentTo = codeState.sentTo ?? requestState.sentTo;

  return (
    <div className="flex flex-col gap-6">
      {linkError && !sentTo && (
        <p className="border-border bg-surface text-text-2 flex items-start gap-2 rounded-lg border p-3 text-sm">
          <AlertCircle aria-hidden size={15} className="text-warn-text mt-0.5 shrink-0" />
          Ce lien est invalide ou a expiré (validité&nbsp;: 30 minutes, usage unique). Demandez-en
          un nouveau ci-dessous.
        </p>
      )}

      <form action={requestAction} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-heading text-sm font-semibold">
          Adresse e-mail utilisée lors de l&apos;inscription
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        />
        <BoutonSite
          type="submit"
          ton="principal"
          disabled={requestPending}
          icone={Mail}
          className="w-fit"
        >
          {requestPending ? "Envoi…" : "Recevoir mon lien d'accès"}
        </BoutonSite>
        {requestState.error && <p className="text-sm text-red-600">{requestState.error}</p>}
      </form>

      {sentTo && (
        <div className="border-border flex flex-col gap-3 rounded-xl border p-5">
          <p className="text-text-2 text-sm">
            Si un compte existe pour <b className="text-heading">{sentTo}</b>, un e-mail contenant
            un lien d&apos;accès et un code à 6 chiffres vient d&apos;être envoyé. Le lien est
            valable 30 minutes.
          </p>
          <form action={codeAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="email" value={sentTo} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="code6" className="text-heading text-sm font-semibold">
                Code à 6 chiffres
              </label>
              <input
                id="code6"
                name="code6"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                className="border-border bg-surface text-text w-40 rounded-lg border px-3 py-2.5 tracking-[0.3em]"
              />
            </div>
            <BoutonSite type="submit" disabled={codePending} icone={KeyRound}>
              {codePending ? "Vérification…" : "Valider le code"}
            </BoutonSite>
          </form>
          {codeState.error && <p className="text-sm text-red-600">{codeState.error}</p>}
        </div>
      )}
    </div>
  );
}
