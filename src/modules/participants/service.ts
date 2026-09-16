import type { Participant, ParticipantStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { jobQueue } from "@/lib/queue";
import { reconcileByEmail } from "@/modules/invitations/service";
import { registerBadgeJobs } from "@/modules/badges/jobs";
import * as repo from "./repository";
import type { ParticipantInput, ParticipantSearchInput } from "./schema";
import { DuplicateParticipantEmailError, InvalidParticipantTransitionError } from "./errors";

export interface Actor {
  type: "USER" | "PARTICIPANT" | "SYSTEM";
  userId?: string;
  participantId?: string;
}

// ---------------------------------------------------------------------------
// Identifiant public (brief §4/§5.4) : non séquentiel, lisible (pas de 0/O/1/I).
// ---------------------------------------------------------------------------

const PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomPublicIdSuffix(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += PUBLIC_ID_ALPHABET[Math.floor(Math.random() * PUBLIC_ID_ALPHABET.length)];
  }
  return out;
}

/** ex. code d'édition "FID-2026" → préfixe "FID26" (ex. complet : FID26-7K3M2P). */
export function publicIdPrefix(editionCode: string): string {
  const [prefix, year] = editionCode.split("-");
  return `${prefix}${(year ?? "").slice(-2)}`;
}

export async function generateUniquePublicId(editionCode: string): Promise<string> {
  const prefix = publicIdPrefix(editionCode);
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${prefix}-${randomPublicIdSuffix()}`;
    const existing = await prisma.participant.findUnique({ where: { publicId: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Impossible de générer un identifiant public unique après 10 tentatives.");
}

// ---------------------------------------------------------------------------
// Mapping formulaire → champs Prisma
// ---------------------------------------------------------------------------

/**
 * Champs communs (hors catégorie/délégation, dont la syntaxe `connect` diffère
 * entre `create` et `update` — cf. `categoryRelation`/`delegationRelation`).
 */
function mapInputToData(input: ParticipantInput) {
  return {
    civility: input.civility || null,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email.toLowerCase(),
    phone: input.phone || null,
    jobTitle: input.jobTitle || null,
    organization: input.organization || null,
    organizationType: input.organizationType || null,
    activityDomain: input.activityDomain || null,
    bio: input.bio || null,
    website: input.website || null,
    country: input.country,
    city: input.city || null,
    locale: input.locale,
    attendsOpening: input.attendsOpening,
    attendsInaugural: input.attendsInaugural,
    attendsAwards: input.attendsAwards,
    needsAccommodation: input.needsAccommodation,
    needsTransport: input.needsTransport,
    dietaryRequirements: input.dietaryRequirements || null,
    specialNeeds: input.specialNeeds || null,
    notes: input.notes || null,
  } satisfies Prisma.ParticipantUpdateInput;
}

/** Pour `update` uniquement — `create` connecte/omet directement (pas de `disconnect` à la création). */
function delegationUpdateRelation(
  input: ParticipantInput,
): Prisma.ParticipantUpdateInput["delegation"] {
  return input.delegationId ? { connect: { id: input.delegationId } } : { disconnect: true };
}

async function assertStatus(
  participant: Pick<Participant, "id" | "status">,
  allowed: ParticipantStatus[],
  action: string,
): Promise<void> {
  if (!allowed.includes(participant.status)) {
    throw new InvalidParticipantTransitionError(participant.status, action);
  }
}

async function logTransition(
  participantId: string,
  action: string,
  before: ParticipantStatus,
  after: ParticipantStatus,
  actor: Actor,
): Promise<void> {
  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    actorParticipantId: actor.participantId,
    action,
    entity: "Participant",
    entityId: participantId,
    before: { status: before },
    after: { status: after },
  });
}

export async function enqueueBadgeGeneration(participantId: string): Promise<void> {
  registerBadgeJobs();
  await jobQueue.enqueue(
    "badge.generate",
    { participantId },
    // Une clé fixe par participant : plusieurs transitions successives ne
    // doivent pas empiler des rendus identiques. La réémission (version+1)
    // passe par `reissueBadge`, pas par cette file.
    { idempotencyKey: `badge-generate:${participantId}` },
  );
}

// ---------------------------------------------------------------------------
// Création (BackOffice, inscription sur place — inscription en ligne = module 3.4)
// ---------------------------------------------------------------------------

export interface CreateParticipantOptions {
  editionId: string;
  editionCode: string;
  input: ParticipantInput;
  source: "ONLINE" | "ONSITE" | "IMPORT";
  actor: Actor;
}

export async function createParticipant(options: CreateParticipantOptions): Promise<Participant> {
  const { editionId, editionCode, input, source, actor } = options;

  const existing = await repo.findParticipantByEmail(editionId, input.email);
  if (existing) {
    throw new DuplicateParticipantEmailError(input.email);
  }

  const category = await prisma.participantCategory.findUniqueOrThrow({
    where: { id: input.categoryId },
  });

  // Inscription sur place = validée immédiatement (brief §5.7) ; en ligne/import,
  // le statut dépend de l'auto-confirmation de la catégorie (brief §5.3).
  const status: ParticipantStatus =
    source === "ONSITE" || category.autoConfirm ? "CONFIRMED" : "REGISTERED";

  const publicId = await generateUniquePublicId(editionCode);
  const now = new Date();

  const participant = await repo.createParticipant({
    publicId,
    edition: { connect: { id: editionId } },
    ...mapInputToData(input),
    category: { connect: { id: input.categoryId } },
    delegation: input.delegationId ? { connect: { id: input.delegationId } } : undefined,
    source,
    status,
    registeredAt: now,
    confirmedAt: status === "CONFIRMED" ? now : null,
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    actorParticipantId: actor.participantId,
    action: "participant.create",
    entity: "Participant",
    entityId: participant.id,
    after: { status: participant.status, email: participant.email, source },
  });

  if (status === "CONFIRMED") {
    await enqueueBadgeGeneration(participant.id);
  }

  await reconcileByEmail(editionId, participant.email, participant.id);

  return participant;
}

/** Édition des informations d'un participant sans changer son statut. */
export async function updateParticipantDetails(
  participantId: string,
  input: ParticipantInput,
  actor: Actor,
): Promise<Participant> {
  const before = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  const updated = await repo.updateParticipant(participantId, {
    ...mapInputToData(input),
    category: { connect: { id: input.categoryId } },
    delegation: delegationUpdateRelation(input),
  });

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    actorParticipantId: actor.participantId,
    action: "participant.update",
    entity: "Participant",
    entityId: participantId,
    before: { email: before.email, categoryId: before.categoryId },
    after: { email: updated.email, categoryId: updated.categoryId },
  });

  return updated;
}

export async function softDeleteParticipant(participantId: string, actor: Actor): Promise<void> {
  await repo.softDeleteParticipant(participantId);
  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    actorParticipantId: actor.participantId,
    action: "participant.delete",
    entity: "Participant",
    entityId: participantId,
  });
}

// ---------------------------------------------------------------------------
// Machine à états unifiée (brief §2.3)
//
//   INVITED → INVITATION_SENT → REGISTRATION_STARTED → REGISTERED → CONFIRMED → BADGED → CHECKED_IN
//                                                     ↘ DECLINED        ↘ CANCELLED
//
// Chaque opération est une fonction dédiée (plutôt qu'une matrice générique de
// transitions) car chacune a ses propres effets de bord (audit, badge, dates).
// ---------------------------------------------------------------------------

export async function markInvitationSent(
  participantId: string,
  actor: Actor,
): Promise<Participant> {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  await assertStatus(participant, ["INVITED"], "mark_invitation_sent");
  const updated = await repo.updateParticipant(participantId, { status: "INVITATION_SENT" });
  await logTransition(
    participantId,
    "participant.invitation_sent",
    participant.status,
    "INVITATION_SENT",
    actor,
  );
  return updated;
}

export async function startRegistration(participantId: string, actor: Actor): Promise<Participant> {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  await assertStatus(participant, ["INVITED", "INVITATION_SENT"], "start_registration");
  const updated = await repo.updateParticipant(participantId, { status: "REGISTRATION_STARTED" });
  await logTransition(
    participantId,
    "participant.registration_started",
    participant.status,
    "REGISTRATION_STARTED",
    actor,
  );
  return updated;
}

/** Soumission du formulaire d'inscription (module 3.4) pour un participant déjà connu (invité). */
export async function completeRegistration(
  participantId: string,
  input: ParticipantInput,
  actor: Actor,
): Promise<Participant> {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  await assertStatus(
    participant,
    ["INVITED", "INVITATION_SENT", "REGISTRATION_STARTED"],
    "complete_registration",
  );

  const category = await prisma.participantCategory.findUniqueOrThrow({
    where: { id: input.categoryId },
  });
  const nextStatus: ParticipantStatus = category.autoConfirm ? "CONFIRMED" : "REGISTERED";
  const now = new Date();

  const updated = await repo.updateParticipant(participantId, {
    ...mapInputToData(input),
    category: { connect: { id: input.categoryId } },
    delegation: delegationUpdateRelation(input),
    status: nextStatus,
    registeredAt: now,
    confirmedAt: nextStatus === "CONFIRMED" ? now : null,
  });

  await logTransition(
    participantId,
    "participant.complete_registration",
    participant.status,
    nextStatus,
    actor,
  );

  if (nextStatus === "CONFIRMED") {
    await enqueueBadgeGeneration(participantId);
  }

  return updated;
}

/** Validation manuelle par le comité (brief §2.3, §5.3). */
export async function confirmParticipant(
  participantId: string,
  actor: Actor,
): Promise<Participant> {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  await assertStatus(participant, ["REGISTERED"], "confirm");

  const updated = await repo.updateParticipant(participantId, {
    status: "CONFIRMED",
    confirmedAt: new Date(),
    confirmedBy: actor.userId ? { connect: { id: actor.userId } } : { disconnect: true },
  });

  await logTransition(participantId, "participant.confirm", participant.status, "CONFIRMED", actor);
  await enqueueBadgeGeneration(participantId);

  return updated;
}

export async function declineParticipant(
  participantId: string,
  actor: Actor,
): Promise<Participant> {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  await assertStatus(
    participant,
    ["INVITED", "INVITATION_SENT", "REGISTRATION_STARTED", "REGISTERED"],
    "decline",
  );
  const updated = await repo.updateParticipant(participantId, { status: "DECLINED" });
  await logTransition(participantId, "participant.decline", participant.status, "DECLINED", actor);
  return updated;
}

export async function cancelParticipant(participantId: string, actor: Actor): Promise<Participant> {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  await assertStatus(participant, ["CONFIRMED", "BADGED"], "cancel");
  const updated = await repo.updateParticipant(participantId, { status: "CANCELLED" });
  await logTransition(participantId, "participant.cancel", participant.status, "CANCELLED", actor);
  return updated;
}

/** Appelé par le job de génération de badge (module 3.6) une fois le PDF/PNG produits. */
export async function markBadged(participantId: string, actor: Actor): Promise<Participant> {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  await assertStatus(participant, ["CONFIRMED"], "mark_badged");
  const updated = await repo.updateParticipant(participantId, { status: "BADGED" });
  await logTransition(participantId, "participant.badged", participant.status, "BADGED", actor);
  return updated;
}

/** Premier scan à l'entrée principale (brief §2.3 : au moins un scan). Module scanner = Lot 2. */
export async function checkIn(participantId: string, actor: Actor): Promise<Participant> {
  const participant = await prisma.participant.findUniqueOrThrow({ where: { id: participantId } });
  await assertStatus(participant, ["BADGED"], "check_in");
  const updated = await repo.updateParticipant(participantId, { status: "CHECKED_IN" });
  await logTransition(
    participantId,
    "participant.checked_in",
    participant.status,
    "CHECKED_IN",
    actor,
  );
  return updated;
}

// ---------------------------------------------------------------------------
// Listing BackOffice
// ---------------------------------------------------------------------------

export async function listParticipants(editionId: string, search: ParticipantSearchInput) {
  return repo.listParticipants({
    editionId,
    q: search.q || undefined,
    status: search.status || undefined,
    categoryId: search.categoryId || undefined,
    country: search.country || undefined,
    page: search.page,
    pageSize: search.pageSize,
  });
}

export async function getParticipant(participantId: string) {
  return repo.findParticipantById(participantId);
}

export async function listCategories(editionId: string) {
  return repo.listCategories(editionId);
}

/** Ré-exporté ici pour que les pages n'aient qu'un seul point d'entrée service. */
export async function listDelegationsForSelect(editionId: string) {
  return repo.listDelegations(editionId);
}
