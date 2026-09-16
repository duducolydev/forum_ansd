"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { requestSpeakerLink } from "@/modules/auth/magic-link";
import { clearSpeakerSession, getSpeakerSession } from "./session";
import {
  createParticipantFromSpeaker,
  createSpeaker,
  definirConsentementPresentation,
  saveSpeakerPhoto,
  selfEditSchema,
  speakerInputSchema,
  SpeakerRuleError,
  updateSelf,
  updateSpeaker,
} from "./service";
import { adresseClient } from "@/lib/adresse-client";

export interface ActionState {
  error?: string;
  message?: string;
}

function messageErreur(error: unknown): string {
  if (error instanceof SpeakerRuleError) return error.message;
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

async function requireSpeaker() {
  const session = await getSpeakerSession();
  if (!session) throw new SpeakerRuleError("Votre lien d'accès a expiré. Demandez-en un nouveau.");
  return session.speakerId;
}

async function requireEditor() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "speakers.write")) throw new Error("Permission refusée.");
  return session;
}

// ---------------------------------------------------------------------------
// Espace intervenant
// ---------------------------------------------------------------------------

/**
 * Demande de lien d'accès.
 *
 * Répond toujours la même chose : le formulaire ne doit pas permettre de savoir
 * qui figure au programme avant l'annonce officielle.
 */
export async function demanderLienAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Adresse e-mail invalide." };

  const edition = await getActiveEdition();
  const ip = adresseClient(await headers());
  const resultat = await requestSpeakerLink(edition.id, email, ip);

  if (resultat.status === "RATE_LIMITED") {
    return { error: `Trop de demandes. Réessayez dans ${resultat.retryAfterSeconds} secondes.` };
  }
  return {
    message:
      "Si cette adresse correspond à un intervenant du Forum, un lien d'accès vient d'être envoyé.",
  };
}

export async function enregistrerFicheAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const speakerId = await requireSpeaker();
    const input = selfEditSchema.parse({
      jobTitle: formData.get("jobTitle") ?? undefined,
      organization: formData.get("organization") ?? undefined,
      country: formData.get("country") ?? undefined,
      bioFr: formData.get("bioFr") ?? undefined,
      bioEn: formData.get("bioEn") ?? undefined,
    });
    await updateSelf(speakerId, input);
  } catch (error) {
    return { error: messageErreur(error) };
  }

  revalidatePath("/espace-intervenant");
  return { message: "Vos informations sont enregistrées." };
}

export async function deposerPhotoAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const speakerId = await requireSpeaker();
    const fichier = formData.get("photo");
    if (!(fichier instanceof File) || fichier.size === 0) {
      return { error: "Aucun fichier sélectionné." };
    }
    await saveSpeakerPhoto(speakerId, fichier);
  } catch (error) {
    return { error: messageErreur(error) };
  }

  revalidatePath("/espace-intervenant");
  return { message: "Photo enregistrée." };
}

/**
 * Accord de publication de la présentation (§15).
 *
 * Le fichier lui-même ne passe plus par une action : il part vers
 * `/api/v1/espace-intervenant/presentation`, les Server Actions refusant sans
 * message tout envoi de plus de 3 Mo (§13.7).
 */
export async function consentementPresentationAction(accord: boolean): Promise<ActionState> {
  try {
    const speakerId = await requireSpeaker();
    await definirConsentementPresentation(speakerId, accord);
  } catch (error) {
    return { error: messageErreur(error) };
  }

  revalidatePath("/espace-intervenant");
  return {
    message: accord
      ? "Publication autorisée. Le comité la validera avant toute mise en ligne."
      : "Autorisation retirée : votre présentation n'est plus publiée sur le site.",
  };
}

export async function seDeconnecterAction(): Promise<void> {
  await clearSpeakerSession();
  revalidatePath("/espace-intervenant");
}

// ---------------------------------------------------------------------------
// BackOffice
// ---------------------------------------------------------------------------

export async function enregistrerIntervenantAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireEditor();
    const actor = { type: "USER" as const, userId: session.user.id };
    const input = speakerInputSchema.parse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email") ?? undefined,
      jobTitle: formData.get("jobTitle") ?? undefined,
      organization: formData.get("organization") ?? undefined,
      country: formData.get("country") ?? undefined,
      bioFr: formData.get("bioFr") ?? undefined,
      bioEn: formData.get("bioEn") ?? undefined,
      isPublished: formData.get("isPublished") === "on",
    });

    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) {
      await updateSpeaker(id, input, actor);
    } else {
      const edition = await getActiveEdition();
      await createSpeaker(edition.id, input, actor);
    }
  } catch (error) {
    return { error: messageErreur(error) };
  }

  revalidatePath("/admin/intervenants");
  revalidatePath("/intervenants");
  return { message: "Intervenant enregistré." };
}

export async function creerParticipantAction(speakerId: string): Promise<ActionState> {
  try {
    const session = await requireEditor();
    const edition = await getActiveEdition();

    // Catégorie par défaut des intervenants : celle des invités spéciaux, la
    // seule du jeu de référence qui corresponde à quelqu'un qu'on a convié.
    const categorie = await prisma.participantCategory.findFirst({
      where: { editionId: edition.id, code: "INVITE_SPECIAL" },
      select: { id: true },
    });
    if (!categorie) {
      return { error: "Catégorie « Invité spécial » introuvable pour cette édition." };
    }

    await createParticipantFromSpeaker(edition.id, edition.code, speakerId, categorie.id, {
      type: "USER",
      userId: session.user.id,
    });
  } catch (error) {
    return { error: messageErreur(error) };
  }

  revalidatePath("/admin/intervenants");
  return { message: "Participant créé et rattaché." };
}
