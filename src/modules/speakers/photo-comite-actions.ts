"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import type { ActionState } from "./actions";
import {
  deposerPhotoParLeComite,
  retirerPhotoParLeComite,
  SpeakerRuleError,
  type CiblePhoto,
} from "./service";

/**
 * Photo d'un participant ou d'un intervenant, déposée par le comité (9 novembre
 * 2026) : ministres, directeurs généraux et d'autres ne le font pas eux-mêmes.
 *
 * Permission de la fiche d'où l'on agit : `participants.write` ou
 * `speakers.write`.
 */
async function exigerEditeur(cible: CiblePhoto) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  const permission = "participantId" in cible ? "participants.write" : "speakers.write";
  if (!can(session, permission)) throw new Error("Permission refusée.");
  return { userId: session.user.id };
}

function invalider(): void {
  revalidatePath("/admin/participants", "layout");
  revalidatePath("/admin/intervenants", "layout");
  revalidatePath("/intervenants");
  revalidatePath("/programme", "layout");
  revalidatePath("/");
}

function messageErreur(error: unknown): string {
  if (error instanceof SpeakerRuleError) return error.message;
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export async function deposerPhotoComiteAction(
  cible: CiblePhoto,
  donnees: FormData,
): Promise<ActionState> {
  try {
    const acteur = await exigerEditeur(cible);
    const fichier = donnees.get("photo");
    if (!(fichier instanceof File) || fichier.size === 0) {
      return { error: "Aucun fichier reçu." };
    }
    await deposerPhotoParLeComite(cible, fichier, acteur);
    invalider();
    return { message: "Photo enregistrée." };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}

export async function retirerPhotoComiteAction(cible: CiblePhoto): Promise<ActionState> {
  try {
    const acteur = await exigerEditeur(cible);
    await retirerPhotoParLeComite(cible, acteur);
    invalider();
    return { message: "Photo retirée." };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}
