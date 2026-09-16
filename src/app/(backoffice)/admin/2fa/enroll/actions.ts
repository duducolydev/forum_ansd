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

  const resultat = await enableTotp(session.user.id, secret, code);
  if (resultat === "CODE_INVALIDE") {
    return { error: "Code invalide. Réessayez." };
  }
  if (resultat === "DEJA_ACTIVE") {
    return {
      error:
        "La vérification en deux étapes est déjà active sur ce compte. Pour changer de téléphone, demandez sa réinitialisation à un gestionnaire des comptes.",
    };
  }

  // L'activation a changé la version de session du compte (§18) : la session
  // en cours n'est plus valable, on repart d'une connexion avec second facteur.
  await signOut({ redirect: false });
  redirect("/connexion?enrolled=1");
}
