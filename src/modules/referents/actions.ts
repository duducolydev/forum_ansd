"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { parseReferentForm } from "./schema";

export interface ActionState {
  error?: string;
}

/**
 * Points d'entrée de l'annuaire des référents (§28).
 *
 * La permission est `delegations.write`, et non une permission nouvelle :
 * l'annuaire n'existe que pour les délégations, et ceux qui les gèrent sont
 * exactement ceux qui doivent pouvoir y désigner quelqu'un. Un jeton de plus
 * dans le catalogue aurait demandé d'arbitrer, rôle par rôle, une question qui
 * ne se pose pas.
 */

async function requireSession(): Promise<Session & { user: NonNullable<Session["user"]> }> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
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

function rafraichir(referentId?: string): void {
  revalidatePath("/admin/referents");
  if (referentId) revalidatePath(`/admin/referents/${referentId}`);
  // La liste des délégations affiche le nom du référent de chacune.
  revalidatePath("/admin/delegations");
}

export async function createReferentAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "delegations.write")) return { error: "Permission refusée." };

    const input = parseReferentForm(formData);
    const edition = await getActiveEdition();
    await service.createReferent(edition.id, input, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichir();
  return {};
}

export async function updateReferentAction(
  referentId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "delegations.write")) return { error: "Permission refusée." };

    await service.updateReferent(
      referentId,
      parseReferentForm(formData),
      actorFromSession(session),
    );
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichir(referentId);
  return {};
}

export async function deleteReferentAction(
  referentId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "delegations.write")) return { error: "Permission refusée." };

    await service.deleteReferent(referentId, actorFromSession(session));
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  rafraichir();
  return {};
}
