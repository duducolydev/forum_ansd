"use server";

import { redirect } from "next/navigation";
import { AuthError, CredentialsSignin } from "next-auth";
import { auth, signIn } from "@/auth";

export interface LoginState {
  error?: string;
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
  redirect("/admin");
}
