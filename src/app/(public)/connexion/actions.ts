"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { adresseClient } from "@/lib/adresse-client";
import { utiliseLaCamera } from "@/lib/pages-camera";
import { destinationSure } from "./destination";

export interface LoginState {
  error?: string;
  /**
   * Destination à charger **par le navigateur**, et non par une redirection de
   * Server Action : celle-ci est une navigation interne, qui garderait la
   * politique de la page de connexion — caméra refusée (PLAN.md §16).
   */
  redirection?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  if (!email || !password) {
    return { error: "INVALID_CREDENTIALS" };
  }

  try {
    // L'adresse du poste voyage avec les identifiants : elle est journalisée avec
    // la demande de code (§23), et le fournisseur Auth.js ne voit pas la requête.
    //
    // Chaque valeur part en chaîne, jamais `undefined` : `signIn` sérialise ses
    // options en `URLSearchParams`, où `undefined` devient le texte
    // « undefined ». Le fournisseur le prendrait pour un code saisi et refuserait
    // la connexion dès le premier envoi, sans jamais en expédier un.
    const ip = adresseClient(await headers());
    await signIn("credentials", { email, password, code, ip, redirect: false });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { error: error.code };
    }
    if (error instanceof AuthError) {
      return { error: error.type };
    }
    throw error;
  }

  const entetes = await headers();
  const destination = destinationSure(
    String(formData.get("callbackUrl") ?? ""),
    entetes.get("x-forwarded-host") ?? entetes.get("host"),
  );

  if (destination && utiliseLaCamera(destination.split("?")[0]!)) {
    return { redirection: destination };
  }
  redirect(destination ?? "/admin");
}

export interface ValidationState {
  error?: string;
}

/**
 * Validation par le lien reçu par e-mail (PLAN.md §23).
 *
 * Action, donc POST : ouvrir le lien ne suffit pas. Les antivirus de messagerie
 * et les aperçus de liens visitent les URL des messages ; si la seule visite
 * consommait le jeton, la personne trouverait un lien déjà utilisé.
 */
export async function validerLienAction(
  _prevState: ValidationState,
  formData: FormData,
): Promise<ValidationState> {
  const jeton = String(formData.get("jeton") ?? "");
  if (!jeton) return { error: "CODE_INVALID" };

  try {
    await signIn("credentials", { jeton, redirect: false });
  } catch (error) {
    if (error instanceof CredentialsSignin) return { error: error.code };
    if (error instanceof AuthError) return { error: error.type };
    throw error;
  }

  redirect("/admin");
}
