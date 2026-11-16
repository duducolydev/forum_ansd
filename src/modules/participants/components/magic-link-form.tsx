"use client";

import { useActionState, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { lireLangue, selon } from "@/lib/langue";
import { requestMagicLinkAction, verifyCodeAction, type MagicLinkState } from "../my-space-actions";
import { TEXTES_REFUS, type MotifRefusAcces } from "@/modules/auth/acces-espace";
import { AlertCircle, Clock, KeyRound, Mail } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";

const initialState: MagicLinkState = {};

export function MagicLinkForm({
  linkError,
  refus,
}: {
  linkError?: boolean;
  /** Refus venu d'un lien ouvert (paramètre d'URL), avant toute saisie ici. */
  refus?: MotifRefusAcces;
}) {
  const [requestState, requestAction, requestPending] = useActionState(
    requestMagicLinkAction,
    initialState,
  );
  const [codeState, codeAction, codePending] = useActionState(verifyCodeAction, initialState);
  const [email, setEmail] = useState("");
  // « J'ai déjà un code » : le code de l'e-mail de confirmation se saisit sans
  // redemander de lien (3 novembre 2026).
  const [saisieDirecte, setSaisieDirecte] = useState(false);
  const champEmail = useRef<HTMLInputElement>(null);
  const langue = lireLangue(useLocale());
  const t = (textes: { fr: string; en: string; pt: string }) => selon(langue, textes);

  const sentTo = codeState.sentTo ?? requestState.sentTo;
  const emailCode = sentTo ?? (saisieDirecte ? email.trim().toLowerCase() : null);

  /*
   * Dossier non validé (16 novembre 2026) : le motif prime sur tout le reste.
   * Il vient soit de la dernière action, soit du lien que la personne vient
   * d'ouvrir. Tant qu'il est là, ni le message « lien expiré » ni le champ du
   * code ne s'affichent : aucun des deux ne décrit ce qui se passe.
   */
  const motifRefus = codeState.refus ?? requestState.refus ?? refus ?? null;
  const texteRefus = motifRefus ? TEXTES_REFUS[motifRefus] : null;

  return (
    <div className="flex flex-col gap-6">
      {texteRefus && (
        <div
          role="status"
          className="border-warn-text/40 bg-warn-soft flex items-start gap-3 rounded-lg border p-4"
        >
          <Clock aria-hidden size={17} className="text-warn-text mt-0.5 shrink-0" />
          <div>
            <p className="text-heading font-semibold">{t(texteRefus.titre)}</p>
            <p className="text-text-2 mt-1 text-sm leading-relaxed">{t(texteRefus.message)}</p>
            {motifRefus === "INSCRIPTION_INCOMPLETE" && (
              <p className="mt-2 text-sm">
                <a href="/inscription" className="text-link underline underline-offset-2">
                  {t({
                    fr: "Remplir le formulaire d'inscription",
                    en: "Fill in the registration form",
                    pt: "Preencher o formulário de inscrição",
                  })}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {linkError && !sentTo && !texteRefus && (
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
          ref={champEmail}
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
        {!emailCode && (
          <button
            type="button"
            onClick={() => {
              if (champEmail.current?.reportValidity()) setSaisieDirecte(true);
            }}
            className="text-link w-fit text-sm underline-offset-2 hover:underline"
          >
            {t({
              fr: "J'ai déjà un code à 6 chiffres (e-mail de confirmation ou de badge)",
              en: "I already have a 6-digit code (confirmation or badge email)",
              pt: "Já tenho um código de 6 dígitos (e-mail de confirmação ou do crachá)",
            })}
          </button>
        )}
      </form>

      {/* Le champ du code disparaît devant un refus : aucun code n'ouvrira
          l'espace tant que le dossier n'est pas validé, et le laisser inviterait
          à réessayer en vain. */}
      {emailCode && !texteRefus && (
        <div className="border-border flex flex-col gap-3 rounded-xl border p-5">
          {sentTo ? (
            <p className="text-text-2 text-sm">
              {t({
                fr: "Si un compte existe pour ",
                en: "If an account exists for ",
                pt: "Se existir uma conta para ",
              })}
              <b className="text-heading">{sentTo}</b>
              {t({
                fr: ", un e-mail contenant un lien d'accès et un code à 6 chiffres vient d'être envoyé. Le lien est valable 30 minutes. Le code de votre e-mail de confirmation reste aussi valable.",
                en: ", an email containing an access link and a 6-digit code has just been sent. The link is valid for 30 minutes. The code in your confirmation email also remains valid.",
                pt: ", acaba de ser enviado um e-mail com uma ligação de acesso e um código de 6 dígitos. A ligação é válida durante 30 minutos. O código do seu e-mail de confirmação também continua válido.",
              })}
            </p>
          ) : (
            <p className="text-text-2 text-sm">
              {t({
                fr: "Saisissez le code à 6 chiffres reçu pour ",
                en: "Enter the 6-digit code received for ",
                pt: "Introduza o código de 6 dígitos recebido para ",
              })}
              <b className="text-heading">{emailCode}</b>.
            </p>
          )}
          <form action={codeAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="email" value={emailCode} />
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
