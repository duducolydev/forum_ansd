"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { loginErrorMessage } from "./error-messages";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const message = loginErrorMessage(state.error);

  return (
    <form action={formAction} className="mx-auto flex max-w-sm flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-heading text-sm font-semibold">
          Adresse e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-heading text-sm font-semibold">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-heading text-sm font-semibold">
          Code de vérification (si activé)
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="border-border bg-surface text-text rounded-lg border px-3 py-2.5"
        />
      </div>
      {message && <p className="text-danger-text text-sm">{message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-text hover:bg-primary-hover mt-1 rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
