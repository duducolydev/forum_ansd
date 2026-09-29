"use server";

import { headers } from "next/headers";
import { adresseClient } from "@/lib/adresse-client";
import { envoyerMessageContact, messageContactSchema } from "./service";

export interface EtatContact {
  envoye?: boolean;
  erreur?: string;
}

/** Un humain met plus de trois secondes à remplir le formulaire ; un robot, non. */
const DELAI_MINIMUM_MS = 3000;

export async function envoyerMessageContactAction(
  _etat: EtatContact,
  formData: FormData,
): Promise<EtatContact> {
  /*
   * Robots : le champ piège (invisible) est rempli, ou le formulaire est
   * soumis dans la seconde. On répond « envoyé » sans rien envoyer — un refus
   * explicite apprendrait au robot ce qui le trahit.
   */
  const piege = String(formData.get("site_web") ?? "");
  const ouvertLe = Number(formData.get("ouvertLe") ?? 0);
  if (piege || !ouvertLe || Date.now() - ouvertLe < DELAI_MINIMUM_MS) return { envoye: true };

  const analyse = messageContactSchema.safeParse({
    nom: formData.get("nom"),
    email: formData.get("email"),
    organisation: formData.get("organisation") ?? "",
    objet: formData.get("objet"),
    message: formData.get("message"),
  });
  if (!analyse.success) {
    return { erreur: analyse.error.issues[0]?.message ?? "Formulaire incomplet." };
  }

  const resultat = await envoyerMessageContact(analyse.data, adresseClient(await headers()));
  if (resultat.status === "LIMITE") {
    return {
      erreur: `Trop de messages envoyés depuis cette adresse. Réessayez dans ${Math.ceil(
        resultat.retryAfterSeconds / 60,
      )} minute(s).`,
    };
  }
  return { envoye: true };
}
