"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";
import { auth, signIn } from "@/auth";
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
  const code = String(formData.get("code") ?? "").trim() || undefined;

  if (!email || !password) {
    return { error: "INVALID_CREDENTIALS" };
  }

  try {
    await signIn("credentials", { email, password, code, redirect: false });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      return { error: error.code };
    }
    if (error instanceof AuthError) {
      return { error: error.type };
    }
    throw error;
  }

  const session = await auth();
  if (session?.user?.requiresTotpEnrollment) {
    redirect("/admin/2fa/enroll");
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
