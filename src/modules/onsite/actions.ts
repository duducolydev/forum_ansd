"use server";

import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { participantInputSchema } from "@/modules/participants/schema";
import { createParticipant } from "@/modules/participants/service";
import { DuplicateParticipantEmailError } from "@/modules/participants/errors";
import { saveParticipantPhoto } from "@/modules/participants/photo";
import {
  finaliser,
  noterImpression,
  rechercher,
  OnsiteError,
  type Candidat,
  type ResultatAccueil,
} from "./service";

export interface AccueilState {
  error?: string;
  resultat?: ResultatAccueil;
}

async function requireAgent() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  // Même permission que la génération de badge : c'est ce que fait l'écran.
  if (!can(session, "badges.generate") || !can(session, "participants.write")) {
    throw new Error("Permission refusée.");
  }
  return session;
}

function messageErreur(error: unknown): string {
  if (error instanceof OnsiteError) return error.message;
  if (error instanceof DuplicateParticipantEmailError) {
    return "Cette adresse est déjà inscrite. Recherchez-la plutôt que de créer un doublon.";
  }
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export async function rechercherAction(terme: string): Promise<{ candidats: Candidat[] }> {
  await requireAgent();
  const edition = await getActiveEdition();
  return { candidats: await rechercher(edition.id, terme) };
}

export async function finaliserAction(
  participantId: string,
  checkpointId: string | null,
): Promise<AccueilState> {
  try {
    const session = await requireAgent();
    const edition = await getActiveEdition();
    const resultat = await finaliser(
      edition.id,
      participantId,
      { type: "USER", userId: session.user.id },
      checkpointId,
    );
    return { resultat };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}

/**
 * Création éclair d'un participant au comptoir (brief §5.7).
 *
 * Formulaire minimal : civilité, prénom, nom, organisation, pays, e-mail ou
 * téléphone, catégorie, photo facultative. Le reste — journées, logistique,
 * régime alimentaire — n'a pas sa place devant une file d'attente et se
 * complète plus tard depuis la fiche.
 */
export async function inscrireSurPlaceAction(
  _prevState: AccueilState,
  formData: FormData,
): Promise<AccueilState> {
  try {
    const session = await requireAgent();
    const edition = await getActiveEdition();
    const actor = { type: "USER" as const, userId: session.user.id };

    const telephone = String(formData.get("phone") ?? "").trim();
    const emailSaisi = String(formData.get("email") ?? "").trim();
    if (!emailSaisi && !telephone) {
      return { error: "Renseignez au moins une adresse e-mail ou un numéro de téléphone." };
    }

    /*
     * Sans adresse, on en fabrique une à partir de l'identifiant : le modèle
     * impose un e-mail unique par édition, et refuser l'inscription faute
     * d'adresse bloquerait quelqu'un qui se présente physiquement au comptoir.
     * L'adresse de repli est visiblement factice, jamais écrite à.
     */
    const email = emailSaisi || `sansmail+${Date.now().toString(36)}@onsite.invalid`;

    const input = participantInputSchema.parse({
      civility: formData.get("civility") || undefined,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email,
      phone: telephone || undefined,
      organization: formData.get("organization") || undefined,
      country: formData.get("country"),
      categoryId: formData.get("categoryId"),
      locale: "fr",
      attendsOpening: false,
      attendsInaugural: false,
      attendsAwards: false,
      needsAccommodation: false,
      needsTransport: false,
      consentTerms: true,
      consentData: true,
      consentImage: false,
    });

    const participant = await createParticipant({
      editionId: edition.id,
      editionCode: edition.code,
      input,
      source: "ONSITE",
      actor,
    });

    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      // Une photo refusée ne doit pas faire perdre l'inscription : le badge
      // sort sans, et la photo se reprend depuis la fiche.
      await saveParticipantPhoto(participant.id, photo).catch(() => undefined);
    }

    const checkpointId = formData.get("checkpointId");
    const resultat = await finaliser(
      edition.id,
      participant.id,
      actor,
      typeof checkpointId === "string" && checkpointId.length > 0 ? checkpointId : null,
    );
    return { resultat };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}

export async function noterImpressionAction(badgeId: string): Promise<{ error?: string }> {
  try {
    const session = await requireAgent();
    await noterImpression(badgeId, { type: "USER", userId: session.user.id });
    return {};
  } catch (error) {
    return { error: messageErreur(error) };
  }
}
