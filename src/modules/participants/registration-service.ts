import type { ParticipantStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { captchaProvider } from "@/lib/captcha";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueNotification } from "@/modules/notifications/jobs";
import { reconcileByEmail, getInvitationByToken } from "@/modules/invitations/service";
import { parametresFrais } from "@/modules/settings/service";
import { etatInscriptions } from "@/modules/settings/regles";
import { enqueueBadgeGeneration, generateUniquePublicId } from "./service";
import { saveParticipantPhoto } from "./photo";
import type { RegistrationInput } from "./registration-schema";

export type RegistrationResult =
  | { status: "OK"; participantId: string; participantStatus: ParticipantStatus }
  | { status: "DUPLICATE_EMAIL" }
  | { status: "RATE_LIMITED"; retryAfterSeconds: number }
  | { status: "CAPTCHA_FAILED" }
  | { status: "CLOSED"; message: string }
  | { status: "CATEGORY_INVALID" }
  | { status: "REJECTED" };

const REGISTRATION_RATE_LIMIT = 5;
const REGISTRATION_WINDOW_SECONDS = 60;

/** Inscription publique (brief §5.3). */
export async function registerPublicParticipant(options: {
  editionId: string;
  editionCode: string;
  input: RegistrationInput;
  ip: string;
  /** Photo de badge, déjà recadrée par le navigateur (brief §5.3). */
  photo?: File | null;
}): Promise<RegistrationResult> {
  const { editionId, editionCode, input, ip, photo } = options;

  // 1. Honeypot — champ invisible que seuls les robots remplissent.
  if (input.fax && input.fax.length > 0) {
    return { status: "REJECTED" };
  }

  /*
   * 2. Guichet ouvert ? (brief §5.14)
   *
   * Contrôlé **ici** et pas seulement à l'affichage : masquer le formulaire
   * n'empêche personne de reposter la requête. Une invitation nominative reste
   * valable hors fenêtre — c'est le comité qui l'a émise, et c'est lui qui
   * décide des dates ; le comptoir d'accueil (`source: "ONSITE"`) passe par un
   * autre chemin et n'est jamais bloqué.
   */
  const invitationLue = input.invitationToken
    ? await getInvitationByToken(input.invitationToken).catch(() => null)
    : null;
  const invitation = invitationLue?.editionId === editionId ? invitationLue : null;

  if (!invitation) {
    const { parametres } = await parametresFrais();
    const etat = etatInscriptions(parametres.inscriptions);
    if (!etat.ouvertes) {
      return {
        status: "CLOSED",
        message:
          input.locale === "en"
            ? parametres.inscriptions.messageFermeEn
            : parametres.inscriptions.messageFermeFr,
      };
    }
  }

  // 3. Limitation de débit : 5 tentatives/minute/IP (brief §7).
  const limit = await rateLimit(
    `registration:${ip}`,
    REGISTRATION_RATE_LIMIT,
    REGISTRATION_WINDOW_SECONDS,
  );
  if (!limit.allowed) {
    return { status: "RATE_LIMITED", retryAfterSeconds: limit.retryAfterSeconds };
  }

  // 4. CAPTCHA (neutre tant que les clés Turnstile ne sont pas fournies — C4).
  if (captchaProvider.enabled) {
    const valid = await captchaProvider.verify(input.captchaToken || null, ip);
    if (!valid) return { status: "CAPTCHA_FAILED" };
  }

  // 5. Doublon : on propose le lien magique plutôt qu'une seconde inscription.
  const existing = await prisma.participant.findUnique({
    where: { editionId_email: { editionId, email: input.email } },
  });
  if (existing) {
    return { status: "DUPLICATE_EMAIL" };
  }

  /*
   * 6. Catégorie : celle de l'invitation prime sur celle choisie au formulaire.
   *
   * On réutilise l'invitation déjà lue à l'étape 2. Une seconde lecture aurait
   * pu renvoyer autre chose — invitation consommée entre-temps — et faire
   * diverger la décision d'ouverture de la catégorie finalement retenue.
   */
  const categoryId = invitation ? invitation.categoryId : input.categoryId;

  /*
   * La catégorie envoyée par le formulaire est une donnée du visiteur : elle
   * doit appartenir à **cette** édition et, hors invitation, être **active** —
   * c'est-à-dire proposée par le formulaire. Elle était auparavant lue par son
   * seul identifiant, ce qui laissait s'inscrire dans une catégorie retirée ou
   * d'une autre édition (PLAN.md §18). Celle d'une invitation a été choisie par
   * le comité : elle vaut même si la catégorie n'est plus proposée au public.
   */
  const category = await prisma.participantCategory.findFirst({
    where: { id: categoryId, editionId, ...(invitation ? {} : { isActive: true }) },
  });
  if (!category) {
    return { status: "CATEGORY_INVALID" };
  }
  const status: ParticipantStatus = category.autoConfirm ? "CONFIRMED" : "REGISTERED";
  const now = new Date();

  const participant = await prisma.participant.create({
    data: {
      publicId: await generateUniquePublicId(editionCode),
      edition: { connect: { id: editionId } },
      category: { connect: { id: categoryId } },
      civility: input.civility || null,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone || null,
      country: input.country,
      city: input.city || null,
      locale: input.locale,
      organization: input.organization || null,
      organizationType: input.organizationType || null,
      jobTitle: input.jobTitle || null,
      activityDomain: input.activityDomain || null,
      bio: input.bio || null,
      website: input.website || null,
      participationDays: input.participationDays,
      attendsOpening: input.attendsOpening,
      attendsInaugural: input.attendsInaugural,
      attendsAwards: input.attendsAwards,
      arrivalDate: input.arrivalDate ? new Date(input.arrivalDate) : null,
      departureDate: input.departureDate ? new Date(input.departureDate) : null,
      needsAccommodation: input.needsAccommodation,
      needsTransport: input.needsTransport,
      dietaryRequirements: input.dietaryRequirements || null,
      specialNeeds: input.specialNeeds || null,
      consentTerms: input.consentTerms,
      consentData: input.consentData,
      consentImage: input.consentImage,
      consentAt: now,
      source: "ONLINE",
      status,
      registeredAt: now,
      confirmedAt: status === "CONFIRMED" ? now : null,
      ...(invitation && invitation.editionId === editionId
        ? { invitation: { connect: { id: invitation.id } } }
        : {}),
    },
  });

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participant.id,
    action: "participant.self_register",
    entity: "Participant",
    entityId: participant.id,
    after: { status, email: participant.email, viaInvitation: Boolean(invitation) },
  });

  // Invitation liée par jeton : on la marque inscrite ; sinon rapprochement par e-mail.
  if (invitation && invitation.editionId === editionId) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "REGISTERED", respondedAt: now },
    });
  } else {
    await reconcileByEmail(editionId, participant.email, participant.id);
  }

  /*
   * La photo est enregistrée **avant** la mise en file du badge : dans l'autre
   * ordre, une catégorie à validation automatique verrait son badge produit
   * pendant l'enregistrement du fichier, donc sans la photo.
   *
   * Un échec ici n'annule pas l'inscription — un format refusé ne doit pas
   * faire perdre un formulaire de cinq étapes ; le participant pourra ajouter
   * sa photo depuis « Mon espace ».
   */
  if (photo && photo.size > 0) {
    await saveParticipantPhoto(participant.id, photo).catch(() => undefined);
  }

  if (status === "CONFIRMED") {
    await enqueueBadgeGeneration(participant.id);
  }

  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  await enqueueNotification(
    {
      editionId,
      templateKey: status === "CONFIRMED" ? "registration_confirmed" : "registration_received",
      to: participant.email,
      participantId: participant.id,
      variables: { prenom: participant.firstName, lien_espace: `${baseUrl}/mon-espace` },
    },
    `registration-${status.toLowerCase()}-${participant.id}`,
  );

  return { status: "OK", participantId: participant.id, participantStatus: status };
}
