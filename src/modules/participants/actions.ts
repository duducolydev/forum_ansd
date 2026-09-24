"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import * as delegationService from "./delegation-service";
import {
  delegationInputSchema,
  participantInputSchema,
  type DelegationInput,
  type ParticipantInput,
} from "./schema";

export interface ActionState {
  error?: string;
}

async function requireSession(): Promise<Session & { user: NonNullable<Session["user"]> }> {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Non authentifié.");
  }
  return session as Session & { user: NonNullable<Session["user"]> };
}

function actorFromSession(session: { user: { id: string } }) {
  return { type: "USER" as const, userId: session.user.id };
}

function firstFieldError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function createParticipantAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "participants.write")) return { error: "Permission refusée." };

    const input = parseParticipantForm(formData);
    const edition = await getActiveEdition();
    await service.createParticipant({
      editionId: edition.id,
      editionCode: edition.code,
      input,
      source: "ONSITE",
      actor: actorFromSession(session),
    });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/participants");
  return {};
}

export async function updateParticipantAction(
  participantId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "participants.write")) return { error: "Permission refusée." };

    const input = parseParticipantForm(formData);
    await service.updateParticipantDetails(participantId, input, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/participants");
  revalidatePath(`/admin/participants/${participantId}`);
  return {};
}

function parseParticipantForm(formData: FormData): ParticipantInput {
  return participantInputSchema.parse({
    civility: formData.get("civility") ?? undefined,
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    jobTitle: formData.get("jobTitle") ?? undefined,
    organization: formData.get("organization") ?? undefined,
    organizationType: formData.get("organizationType") ?? undefined,
    country: formData.get("country"),
    city: formData.get("city") ?? undefined,
    categoryId: formData.get("categoryId"),
    delegationId: formData.get("delegationId") ?? undefined,
    locale: (formData.get("locale") as "fr" | "en") ?? "fr",
    attendsOpening: formData.get("attendsOpening") === "on",
    attendsInaugural: formData.get("attendsInaugural") === "on",
    attendsAwards: formData.get("attendsAwards") === "on",
    needsAccommodation: formData.get("needsAccommodation") === "on",
    needsTransport: formData.get("needsTransport") === "on",
    dietaryRequirements: formData.get("dietaryRequirements") ?? undefined,
    specialNeeds: formData.get("specialNeeds") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
}

async function runTransition(
  participantId: string,
  permission: Parameters<typeof can>[1],
  operation: (id: string, actor: ReturnType<typeof actorFromSession>) => Promise<unknown>,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, permission)) return { error: "Permission refusée." };
    await operation(participantId, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }
  revalidatePath("/admin/participants");
  revalidatePath(`/admin/participants/${participantId}`);
  return {};
}

export async function confirmParticipantAction(participantId: string): Promise<ActionState> {
  return runTransition(participantId, "participants.write", service.confirmParticipant);
}

export async function declineParticipantAction(participantId: string): Promise<ActionState> {
  return runTransition(participantId, "participants.write", service.declineParticipant);
}

export async function cancelParticipantAction(participantId: string): Promise<ActionState> {
  return runTransition(participantId, "participants.write", service.cancelParticipant);
}

export async function deleteParticipantAction(participantId: string): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "participants.delete")) return { error: "Permission refusée." };
    await service.softDeleteParticipant(participantId, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }
  revalidatePath("/admin/participants");
  return {};
}

// ---------------------------------------------------------------------------
// Délégations
// ---------------------------------------------------------------------------

export async function createDelegationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "delegations.write")) return { error: "Permission refusée." };

    const input = parseDelegationForm(formData);
    const edition = await getActiveEdition();
    await delegationService.createDelegation(edition.id, input, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/delegations");
  return {};
}

export async function updateDelegationAction(
  delegationId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "delegations.write")) return { error: "Permission refusée." };

    const input = parseDelegationForm(formData);
    await delegationService.updateDelegation(delegationId, input, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/delegations");
  revalidatePath(`/admin/delegations/${delegationId}`);
  return {};
}

export async function setDelegationHeadAction(
  delegationId: string,
  participantId: string,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "delegations.write")) return { error: "Permission refusée." };
    await delegationService.setDelegationHead(
      delegationId,
      participantId,
      actorFromSession(session),
    );
  } catch (error) {
    return { error: firstFieldError(error) };
  }
  revalidatePath(`/admin/delegations/${delegationId}`);
  return {};
}

function parseDelegationForm(formData: FormData): DelegationInput {
  return delegationInputSchema.parse({
    name: formData.get("name"),
    country: formData.get("country") ?? undefined,
    institution: formData.get("institution") ?? undefined,
    referentId: formData.get("referentId") ?? undefined,
    maxMembers: formData.get("maxMembers") || undefined,
  });
}
