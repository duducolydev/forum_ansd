"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveEdition } from "@/lib/edition";
import { consumeCode, requestMagicLink } from "@/modules/auth/magic-link";
import {
  clearParticipantSession,
  createParticipantSession,
  getParticipantSession,
} from "@/modules/auth/participant-session";
import { mySpaceInputSchema, requestAccountDeletion, updateMyInfo } from "./my-space-service";
import { removeParticipantPhoto, saveParticipantPhoto } from "./photo";
import { adresseClient } from "@/lib/adresse-client";

// Jamais le premier élément de X-Forwarded-For, que le client choisit (§18).
async function clientIp(): Promise<string> {
  return adresseClient(await headers());
}

export interface MagicLinkState {
  error?: string;
  /** E-mail pour lequel un lien vient d'être demandé (affiche le champ « code »). */
  sentTo?: string;
}

const emailSchema = z.string().trim().toLowerCase().email("Adresse e-mail invalide");

export async function requestMagicLinkAction(
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]!.message };
  }

  const edition = await getActiveEdition();
  const result = await requestMagicLink(edition.id, parsed.data, await clientIp());

  if (result.status === "RATE_LIMITED") {
    return {
      error: `Trop de demandes. Réessayez dans ${result.retryAfterSeconds} seconde(s).`,
      sentTo: parsed.data,
    };
  }
  return { sentTo: parsed.data };
}

export async function verifyCodeAction(
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  const code = String(formData.get("code6") ?? "").trim();

  if (!parsedEmail.success || !/^\d{6}$/.test(code)) {
    return { error: "Code invalide.", sentTo: parsedEmail.success ? parsedEmail.data : undefined };
  }

  const edition = await getActiveEdition();
  const result = await consumeCode(edition.id, parsedEmail.data, code);

  if (result.status === "RATE_LIMITED") {
    return {
      error: `Trop de tentatives. Réessayez dans ${result.retryAfterSeconds} seconde(s).`,
      sentTo: parsedEmail.data,
    };
  }
  if (result.status === "INVALID") {
    return { error: "Code invalide ou expiré.", sentTo: parsedEmail.data };
  }

  await createParticipantSession(result.participantId);
  redirect("/mon-espace");
}

export interface MySpaceState {
  error?: string;
  success?: string;
}

export async function updateMyInfoAction(
  _prevState: MySpaceState,
  formData: FormData,
): Promise<MySpaceState> {
  const session = await getParticipantSession();
  if (!session) return { error: "Session expirée. Reconnectez-vous." };

  const parsed = mySpaceInputSchema.safeParse({
    civility: formData.get("civility") ?? undefined,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? undefined,
    city: formData.get("city") ?? undefined,
    organization: formData.get("organization") ?? undefined,
    jobTitle: formData.get("jobTitle") ?? undefined,
    dietaryRequirements: formData.get("dietaryRequirements") ?? undefined,
    specialNeeds: formData.get("specialNeeds") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]!.message };
  }

  try {
    await updateMyInfo(session.participantId, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Mise à jour impossible." };
  }

  revalidatePath("/mon-espace");
  return { success: "Vos informations ont été mises à jour." };
}

export async function requestDeletionAction(
  _prevState: MySpaceState,
  formData: FormData,
): Promise<MySpaceState> {
  const session = await getParticipantSession();
  if (!session) return { error: "Session expirée. Reconnectez-vous." };

  if (formData.get("confirm") !== "SUPPRIMER") {
    return { error: "Saisissez SUPPRIMER pour confirmer la demande." };
  }

  try {
    await requestAccountDeletion(session.participantId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Demande impossible." };
  }

  return {
    success:
      "Votre demande de suppression a été enregistrée. Le comité d'organisation vous répondra sous 30 jours.",
  };
}

export async function logoutAction(): Promise<void> {
  await clearParticipantSession();
  redirect("/mon-espace");
}

/**
 * Enregistrement de la photo de profil.
 *
 * Le `FormData` est construit par l'appelant plutôt que rendu par un
 * formulaire : la sérialisation automatique de React s'est déjà montrée
 * capable d'envoyer des valeurs périmées (cf. TODO T32), ce qu'on ne veut pas
 * risquer sur un fichier.
 */
export async function updateMyPhotoAction(formData: FormData): Promise<MySpaceState> {
  const session = await getParticipantSession();
  if (!session) return { error: "Session expirée. Reconnectez-vous." };

  const fichier = formData.get("photo");
  if (!(fichier instanceof File)) return { error: "Aucun fichier reçu." };

  const resultat = await saveParticipantPhoto(session.participantId, fichier);

  switch (resultat.status) {
    case "OK":
      revalidatePath("/mon-espace");
      return { success: "Photo enregistrée. Elle figurera sur votre badge." };
    case "TOO_LARGE":
      return {
        error: `Image trop lourde (${Math.round(resultat.maxBytes / 1024 / 1024)} Mo maximum).`,
      };
    case "UNSUPPORTED_TYPE":
      return { error: "Format non reconnu. Utilisez une image JPEG, PNG ou WebP." };
    case "EMPTY":
      return { error: "Fichier vide." };
  }
}

export async function removeMyPhotoAction(): Promise<MySpaceState> {
  const session = await getParticipantSession();
  if (!session) return { error: "Session expirée. Reconnectez-vous." };

  await removeParticipantPhoto(session.participantId);
  revalidatePath("/mon-espace");
  return { success: "Photo retirée." };
}
