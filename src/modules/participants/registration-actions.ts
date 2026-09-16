"use server";

import { headers } from "next/headers";
import { getActiveEdition } from "@/lib/edition";
import { registrationSchema } from "./registration-schema";
import { registerPublicParticipant } from "./registration-service";
import { adresseClient } from "@/lib/adresse-client";

export interface RegistrationState {
  error?: string;
  /** L'e-mail est déjà inscrit : l'UI propose le lien magique plutôt qu'un doublon. */
  duplicateEmail?: boolean;
  success?: { autoConfirmed: boolean };
}

// Jamais le premier élément de X-Forwarded-For, que le client choisit (§18).
async function clientIp(): Promise<string> {
  return adresseClient(await headers());
}

function firstFieldError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export async function submitRegistrationAction(
  _prevState: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  try {
    const input = registrationSchema.parse({
      civility: formData.get("civility") ?? undefined,
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone") ?? undefined,
      country: formData.get("country"),
      city: formData.get("city") ?? undefined,
      locale: (formData.get("locale") as "fr" | "en") ?? "fr",
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
        return { success: { autoConfirmed: result.participantStatus === "CONFIRMED" } };
      case "DUPLICATE_EMAIL":
        return { duplicateEmail: true };
      case "RATE_LIMITED":
        return {
          error: `Trop de tentatives. Réessayez dans ${result.retryAfterSeconds} seconde(s).`,
        };
      case "CAPTCHA_FAILED":
        return { error: "Vérification anti-robot échouée. Réessayez." };
      case "CLOSED":
        // Le message vient des paramètres de l'édition, dans la langue du visiteur.
        return { error: result.message };
      case "CATEGORY_INVALID":
        return {
          error:
            input.locale === "en"
              ? "This participation category is no longer offered. Please reload the page."
              : "Cette catégorie de participation n'est plus proposée. Rechargez la page.",
        };
      case "REJECTED":
        return { error: "Requête rejetée." };
    }
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}
