"use client";

import { useActionState, useState } from "react";
import { useLocale } from "next-intl";
import { lireLangue, selon } from "@/lib/langue";
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
  const langue = lireLangue(useLocale());
  const t = (textes: { fr: string; en: string; pt: string }) => selon(langue, textes);

  const sentTo = codeState.sentTo ?? requestState.sentTo;

  return (
    <div className="flex flex-col gap-6">
      {linkError && !sentTo && (
        <p className="border-border bg-surface text-text-2 flex items-start gap-2 rounded-lg border p-3 text-sm">
          <AlertCircle aria-hidden size={15} className="text-warn-text mt-0.5 shrink-0" />
          {t({
            fr: "Ce lien est invalide ou a expiré (validité\u00a0: 30 minutes, usage unique). Demandez-en un nouveau ci-dessous.",
            en: "This link is invalid or has expired (valid for 30 minutes, single use). Request a new one below.",
            pt: "Esta ligação é inválida ou expirou (validade: 30 minutos, utilização única). Peça uma nova abaixo.",
          })}
        </p>
      )}

      <form action={requestAction} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-heading text-sm font-semibold">
          {t({
            fr: "Adresse e-mail utilisée lors de l'inscription",
            en: "Email address used to register",
            pt: "Endereço de e-mail utilizado na inscrição",
          })}
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
          {requestPending
            ? t({ fr: "Envoi…", en: "Sending…", pt: "A enviar…" })
            : t({
                fr: "Recevoir mon lien d'accès",
                en: "Get my access link",
                pt: "Receber a minha ligação de acesso",
              })}
        </BoutonSite>
        {requestState.error && <p className="text-sm text-red-600">{requestState.error}</p>}
      </form>

      {sentTo && (
        <div className="border-border flex flex-col gap-3 rounded-xl border p-5">
          <p className="text-text-2 text-sm">
            {t({
              fr: "Si un compte existe pour ",
              en: "If an account exists for ",
              pt: "Se existir uma conta para ",
            })}
            <b className="text-heading">{sentTo}</b>
            {t({
              fr: ", un e-mail contenant un lien d'accès et un code à 6 chiffres vient d'être envoyé. Le lien est valable 30 minutes.",
              en: ", an email containing an access link and a 6-digit code has just been sent. The link is valid for 30 minutes.",
              pt: ", acaba de ser enviado um e-mail com uma ligação de acesso e um código de 6 dígitos. A ligação é válida durante 30 minutos.",
            })}
          </p>
          <form action={codeAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="email" value={sentTo} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="code6" className="text-heading text-sm font-semibold">
                {t({ fr: "Code à 6 chiffres", en: "6-digit code", pt: "Código de 6 dígitos" })}
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
              {codePending
                ? t({ fr: "Vérification…", en: "Checking…", pt: "A verificar…" })
                : t({ fr: "Valider le code", en: "Confirm code", pt: "Validar o código" })}
            </BoutonSite>
          </form>
          {codeState.error && <p className="text-sm text-red-600">{codeState.error}</p>}
        </div>
      )}
    </div>
  );
}
