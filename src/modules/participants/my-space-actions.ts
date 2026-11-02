"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getLocale } from "next-intl/server";
import { lireLangue, selon } from "@/lib/langue";
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
import { MOT_SUPPRESSION, messageAttente, traduireErreur } from "./registration-i18n";

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
  const langue = await langueVisiteur();
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: traduireErreur(langue, parsed.error.issues[0]!.message) };
  }

  const edition = await getActiveEdition();
  const result = await requestMagicLink(edition.id, parsed.data, await clientIp());

  if (result.status === "RATE_LIMITED") {
    return {
      error: selon(langue, {
        fr: `Trop de demandes. Réessayez dans ${result.retryAfterSeconds} seconde(s).`,
        en: `Too many requests. Try again in ${result.retryAfterSeconds} second(s).`,
        pt: `Demasiados pedidos. Tente novamente dentro de ${result.retryAfterSeconds} segundo(s).`,
      }),
      sentTo: parsed.data,
    };
  }
  return { sentTo: parsed.data };
}

export async function verifyCodeAction(
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const langue = await langueVisiteur();
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  const code = String(formData.get("code6") ?? "").trim();

  if (!parsedEmail.success || !/^\d{6}$/.test(code)) {
    return {
      error: selon(langue, { fr: "Code invalide.", en: "Invalid code.", pt: "Código inválido." }),
      sentTo: parsedEmail.success ? parsedEmail.data : undefined,
    };
  }

  const edition = await getActiveEdition();
  const result = await consumeCode(edition.id, parsedEmail.data, code);

  if (result.status === "RATE_LIMITED") {
    return {
      error: messageAttente(langue, result.retryAfterSeconds),
      sentTo: parsedEmail.data,
    };
  }
  if (result.status === "INVALID") {
    return {
      error: selon(langue, {
        fr: "Code invalide ou expiré.",
        en: "Invalid or expired code.",
        pt: "Código inválido ou expirado.",
      }),
      sentTo: parsedEmail.data,
    };
  }

  await createParticipantSession(result.participantId);
  redirect("/mon-espace");
}

/** Langue du visiteur, lue dans le cookie de langue. */
async function langueVisiteur() {
  return lireLangue(await getLocale());
}

function sessionExpiree(langue: string): MySpaceState {
  return {
    error: selon(langue, {
      fr: "Session expirée. Reconnectez-vous.",
      en: "Session expired. Please sign in again.",
      pt: "Sessão expirada. Volte a iniciar sessão.",
    }),
  };
}

export interface MySpaceState {
  error?: string;
  success?: string;
}

export async function updateMyInfoAction(
  _prevState: MySpaceState,
  formData: FormData,
): Promise<MySpaceState> {
  const langue = await langueVisiteur();
  const session = await getParticipantSession();
  if (!session) return sessionExpiree(langue);

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
    return { error: traduireErreur(langue, parsed.error.issues[0]!.message) };
  }

  try {
    await updateMyInfo(session.participantId, parsed.data);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? traduireErreur(langue, error.message)
          : selon(langue, {
              fr: "Mise à jour impossible.",
              en: "Update failed.",
              pt: "Não foi possível atualizar.",
            }),
    };
  }

  revalidatePath("/mon-espace");
  return {
    success: selon(langue, {
      fr: "Vos informations ont été mises à jour.",
      en: "Your details have been updated.",
      pt: "Os seus dados foram atualizados.",
    }),
  };
}

export async function requestDeletionAction(
  _prevState: MySpaceState,
  formData: FormData,
): Promise<MySpaceState> {
  const langue = await langueVisiteur();
  const session = await getParticipantSession();
  if (!session) return sessionExpiree(langue);

  const saisie = String(formData.get("confirm") ?? "")
    .trim()
    .toUpperCase();
  if (!Object.values(MOT_SUPPRESSION).includes(saisie)) {
    const mot = selon(langue, MOT_SUPPRESSION);
    return {
      error: selon(langue, {
        fr: `Saisissez ${mot} pour confirmer la demande.`,
        en: `Type ${mot} to confirm the request.`,
        pt: `Escreva ${mot} para confirmar o pedido.`,
      }),
    };
  }

  try {
    await requestAccountDeletion(session.participantId);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? traduireErreur(langue, error.message)
          : selon(langue, {
              fr: "Demande impossible.",
              en: "Request failed.",
              pt: "Não foi possível enviar o pedido.",
            }),
    };
  }

  return {
    success: selon(langue, {
      fr: "Votre demande de suppression a été enregistrée. Le comité d'organisation vous répondra sous 30 jours.",
      en: "Your deletion request has been recorded. The organising committee will reply within 30 days.",
      pt: "O seu pedido de eliminação foi registado. A comissão organizadora responderá no prazo de 30 dias.",
    }),
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
  const langue = await langueVisiteur();
  const session = await getParticipantSession();
  if (!session) return sessionExpiree(langue);

  const fichier = formData.get("photo");
  if (!(fichier instanceof File)) {
    return {
      error: selon(langue, {
        fr: "Aucun fichier reçu.",
        en: "No file received.",
        pt: "Nenhum ficheiro recebido.",
      }),
    };
  }

  const resultat = await saveParticipantPhoto(session.participantId, fichier);

  switch (resultat.status) {
    case "OK":
      revalidatePath("/mon-espace");
      return {
        success: selon(langue, {
          fr: "Photo enregistrée. Elle figurera sur votre badge.",
          en: "Photo saved. It will appear on your badge.",
          pt: "Fotografia guardada. Figurará no seu crachá.",
        }),
      };
    case "TOO_LARGE": {
      const mo = Math.round(resultat.maxBytes / 1024 / 1024);
      return {
        error: selon(langue, {
          fr: `Image trop lourde (${mo} Mo maximum).`,
          en: `Image too large (${mo} MB maximum).`,
          pt: `Imagem demasiado pesada (${mo} MB no máximo).`,
        }),
      };
    }
    case "UNSUPPORTED_TYPE":
      return {
        error: selon(langue, {
          fr: "Format non reconnu. Utilisez une image JPEG, PNG ou WebP.",
          en: "Unrecognised format. Use a JPEG, PNG or WebP image.",
          pt: "Formato não reconhecido. Utilize uma imagem JPEG, PNG ou WebP.",
        }),
      };
    case "EMPTY":
      return {
        error: selon(langue, { fr: "Fichier vide.", en: "Empty file.", pt: "Ficheiro vazio." }),
      };
  }
}

export async function removeMyPhotoAction(): Promise<MySpaceState> {
  const langue = await langueVisiteur();
  const session = await getParticipantSession();
  if (!session) return sessionExpiree(langue);

  await removeParticipantPhoto(session.participantId);
  revalidatePath("/mon-espace");
  return {
    success: selon(langue, {
      fr: "Photo retirée.",
      en: "Photo removed.",
      pt: "Fotografia removida.",
    }),
  };
}
