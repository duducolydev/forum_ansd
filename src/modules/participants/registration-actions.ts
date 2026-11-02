"use server";

import { lireLangue, selon } from "@/lib/langue";
import { headers } from "next/headers";
import { getActiveEdition } from "@/lib/edition";
import { registrationSchema } from "./registration-schema";
import { registerPublicParticipant } from "./registration-service";
import { adresseClient } from "@/lib/adresse-client";
import { messageAttente, traduireErreur } from "./registration-i18n";

export interface RegistrationState {
  error?: string;
  /** L'e-mail est déjà inscrit : l'UI propose le lien magique plutôt qu'un doublon. */
  duplicateEmail?: boolean;
  success?: { autoConfirmed: boolean; accreditation: boolean };
}

// Jamais le premier élément de X-Forwarded-For, que le client choisit (§18).
async function clientIp(): Promise<string> {
  return adresseClient(await headers());
}

function firstFieldError(error: unknown, langue: string): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return traduireErreur(langue, issues[0].message);
  }
  return traduireErreur(
    langue,
    error instanceof Error ? error.message : "Une erreur est survenue.",
  );
}

export async function submitRegistrationAction(
  _prevState: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  // Lue avant la validation : une saisie refusée doit l'être dans la langue du visiteur.
  const langue = lireLangue(formData.get("locale"));
  try {
    const input = registrationSchema.parse({
      civility: formData.get("civility") ?? undefined,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone") ?? undefined,
      country: formData.get("country"),
      city: formData.get("city") ?? undefined,
      locale: langue,
      categoryId: formData.get("categoryId"),
      organization: formData.get("organization") ?? undefined,
      organizationType: formData.get("organizationType") ?? undefined,
      jobTitle: formData.get("jobTitle") ?? undefined,
      activityDomain: formData.get("activityDomain") ?? undefined,
      bio: formData.get("bio") ?? undefined,
      website: formData.get("website") ?? undefined,
      participationDays: formData.getAll("participationDays").map(String),
      attendsOpening: formData.get("attendsOpening") === "on",
      attendsInaugural: formData.get("attendsInaugural") === "on",
      attendsClosing: formData.get("attendsClosing") === "on",
      attendsAwards: formData.get("attendsAwards") === "on",
      arrivalDate: formData.get("arrivalDate") ?? undefined,
      departureDate: formData.get("departureDate") ?? undefined,
      needsAccommodation: formData.get("needsAccommodation") === "on",
      needsTransport: formData.get("needsTransport") === "on",
      dietaryRequirements: formData.get("dietaryRequirements") ?? undefined,
      specialNeeds: formData.get("specialNeeds") ?? undefined,
      consentTerms: formData.get("consentTerms") === "on",
      consentData: formData.get("consentData") === "on",
      consentImage: formData.get("consentImage") === "on",
      invitationToken: formData.get("invitationToken") ?? undefined,
      captchaToken: formData.get("captchaToken") ?? undefined,
      fax: formData.get("fax") ?? undefined,
    });

    const edition = await getActiveEdition();
    const photo = formData.get("photo");
    const result = await registerPublicParticipant({
      editionId: edition.id,
      editionCode: edition.code,
      input,
      ip: await clientIp(),
      photo: photo instanceof File ? photo : null,
    });

    switch (result.status) {
      case "OK":
        return {
          success: {
            autoConfirmed: result.participantStatus === "CONFIRMED",
            accreditation: result.accreditation,
          },
        };
      case "DUPLICATE_EMAIL":
        return { duplicateEmail: true };
      case "RATE_LIMITED":
        return { error: messageAttente(langue, result.retryAfterSeconds) };
      case "CAPTCHA_FAILED":
        return {
          error: selon(langue, {
            fr: "Vérification anti-robot échouée. Réessayez.",
            en: "Anti-robot check failed. Please try again.",
            pt: "A verificação anti-robô falhou. Tente novamente.",
          }),
        };
      case "CLOSED":
        // Le message vient des paramètres de l'édition, dans la langue du visiteur.
        return { error: result.message };
      case "CATEGORY_INVALID":
        return {
          error: selon(input.locale, {
            fr: "Cette catégorie de participation n'est plus proposée. Rechargez la page.",
            en: "This participation category is no longer offered. Please reload the page.",
            pt: "Esta categoria de participação já não está disponível. Recarregue a página.",
          }),
        };
      case "REJECTED":
        return { error: `${traduireErreur(langue, "Requête rejetée")}.` };
    }
  } catch (error) {
    return { error: firstFieldError(error, langue) };
  }
}
