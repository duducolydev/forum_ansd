"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertCircle, KeyRound, LogIn, Mail, MailCheck, ShieldCheck } from "lucide-react";
import { BoutonSite } from "@/components/site/bouton-site";
import { useSoumissionSansRemiseAZero } from "@/lib/soumission";
import { loginAction, type LoginState } from "./actions";
import { loginErrorMessage, loginInfoMessage } from "./error-messages";

const initialState: LoginState = {};

/**
 * Connexion de l'organisation.
 *
 * Les libellés sont ceux repris par le parcours de test automatisé
 * (« Adresse e-mail », « Mot de passe », « Code reçu par e-mail », bouton
 * « Se connecter ») : les renommer casserait la connexion de la suite E2E, qui
 * est le seul garde-fou sur le reste du BackOffice.
 *
 * Le second facteur se joue en deux temps (PLAN.md §23) : le premier envoi
 * répond « code envoyé », le second porte le code. L'envoi passe donc par
 * `useSoumissionSansRemiseAZero` — sans lui, React 19 viderait le formulaire
 * entre les deux, et il faudrait ressaisir l'adresse et le mot de passe.
 *
 * L'icône posée dans chaque champ est décorative — le nom accessible reste
 * porté par le `<label>`.
 */
const CHAMP =
  "border-border bg-surface text-text focus:border-link w-full rounded-lg border py-2.5 pr-3 pl-10 transition-colors";

export function LoginForm({ callbackUrl = "" }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const { soumettre } = useSoumissionSansRemiseAZero(formAction);
  const message = loginErrorMessage(state.error);
  const information = loginInfoMessage(state.error);
  const champCode = useRef<HTMLInputElement>(null);

  // Le code vient d'être envoyé : le curseur va là où il faut le saisir.
  useEffect(() => {
    if (state.error === "CODE_SENT") champCode.current?.focus();
  }, [state.error]);

  // Page caméra : chargement complet par le navigateur (voir `LoginState`).
  useEffect(() => {
    if (state.redirection) window.location.assign(state.redirection);
  }, [state.redirection]);

  return (
    <form
      onSubmit={soumettre}
      className="border-border bg-surface mx-auto flex max-w-sm flex-col gap-4 rounded-2xl border p-7 shadow-sm"
    >
      {/* Validée côté serveur : seules les pages du BackOffice et du scanner de
          ce site sont acceptées (`destination.ts`). */}
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-heading text-sm font-semibold">
          Adresse e-mail
        </label>
        <span className="relative block">
          <Mail
            aria-hidden
            size={16}
            className="text-text-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className={CHAMP}
          />
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-heading text-sm font-semibold">
          Mot de passe
        </label>
        <span className="relative block">
          <KeyRound
            aria-hidden
            size={16}
            className="text-text-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={CHAMP}
          />
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-heading text-sm font-semibold">
          Code reçu par e-mail
        </label>
        <span className="relative block">
          <ShieldCheck
            aria-hidden
            size={16}
            className="text-text-3 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <input
            ref={champCode}
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${CHAMP} tracking-[0.3em]`}
          />
        </span>
        <span className="text-text-3 text-xs">
          Laissez vide pour recevoir un code : il part vers l&apos;adresse du compte dès que le mot
          de passe est accepté.
        </span>
      </div>

      {information && (
        <p className="text-blue-text bg-blue-soft flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <MailCheck aria-hidden size={15} className="mt-0.5 shrink-0" />
          {information}
        </p>
      )}

      {message && (
        <p className="text-danger-text bg-danger-soft flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm">
          <AlertCircle aria-hidden size={15} className="mt-0.5 shrink-0" />
          {message}
        </p>
      )}

      <BoutonSite
        type="submit"
        ton="principal"
        disabled={pending || Boolean(state.redirection)}
        icone={LogIn}
        className="mt-1"
      >
        {pending || state.redirection ? "Connexion…" : "Se connecter"}
      </BoutonSite>
    </form>
  );
}
