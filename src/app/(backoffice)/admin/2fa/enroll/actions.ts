"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { enableTotp } from "@/modules/auth/service";

export interface EnrollState {
  error?: string;
}

export async function confirmEnrollAction(
  _prevState: EnrollState,
  formData: FormData,
): Promise<EnrollState> {
  const session = await auth();
  if (!session?.user) {
    redirect("/connexion");
  }

  const secret = String(formData.get("secret") ?? "");
  const code = String(formData.get("code") ?? "").trim();

  const ok = await enableTotp(session.user.id, secret, code);
  if (!ok) {
    return { error: "Code invalide. Réessayez." };
  }

  // La session en cours (JWT) ne reflète pas encore `totpEnabled` : on force
  // une reconnexion pour repartir d'un jeton à jour plutôt que de dépendre
  // d'une mise à jour de session côté serveur.
  await signOut({ redirect: false });
  redirect("/connexion?enrolled=1");
}
