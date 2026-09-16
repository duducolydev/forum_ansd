"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { checkpointInputSchema, overrideInputSchema, zoneInputSchema } from "./schema";

export interface ActionState {
  error?: string;
  message?: string;
}

async function requireManager() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "zones.manage")) throw new Error("Permission refusée.");
  return session;
}

function firstFieldError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

function refresh() {
  revalidatePath("/admin/zones");
}

// ---------------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------------

export async function saveZoneAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireManager();
    const actor = { type: "USER" as const, userId: session.user.id };
    const input = zoneInputSchema.parse({
      code: String(formData.get("code") ?? "").toUpperCase(),
      name: formData.get("name"),
      description: formData.get("description") ?? undefined,
    });

    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) {
      await service.updateZone(id, input, actor);
    } else {
      const edition = await getActiveEdition();
      await service.createZone(edition.id, input, actor);
    }
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return { message: "Zone enregistrée." };
}

export async function deleteZoneAction(id: string): Promise<ActionState> {
  try {
    const session = await requireManager();
    await service.deleteZone(id, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Points de contrôle
// ---------------------------------------------------------------------------

export async function saveCheckpointAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireManager();
    const actor = { type: "USER" as const, userId: session.user.id };
    const input = checkpointInputSchema.parse({
      name: formData.get("name"),
      zoneId: formData.get("zoneId"),
      deviceLabel: formData.get("deviceLabel") ?? undefined,
      isActive: formData.get("isActive") === "on",
    });

    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) {
      await service.updateCheckpoint(id, input, actor);
    } else {
      const edition = await getActiveEdition();
      await service.createCheckpoint(edition.id, input, actor);
    }
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return { message: "Point de contrôle enregistré." };
}

export async function deleteCheckpointAction(id: string): Promise<ActionState> {
  try {
    const session = await requireManager();
    await service.deleteCheckpoint(id, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Matrice
// ---------------------------------------------------------------------------

export async function saveMatrixAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireManager();
    const edition = await getActiveEdition();
    const { ajouts, retraits, alertes } = await service.saveAccessMatrix(
      edition.id,
      formData.getAll("cell").map(String),
      formData.getAll("alert").map(String),
      { type: "USER", userId: session.user.id },
    );

    refresh();
    if (ajouts.length === 0 && retraits.length === 0 && alertes.length === 0) {
      return { message: "Aucun changement." };
    }
    const parties = [`${ajouts.length} ouverture(s)`, `${retraits.length} fermeture(s)`];
    if (alertes.length > 0) parties.push(`${alertes.length} accueil(s) modifié(s)`);
    return { message: `Matrice enregistrée : ${parties.join(", ")}.` };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}

// ---------------------------------------------------------------------------
// Exceptions individuelles
// ---------------------------------------------------------------------------

export async function grantOverrideAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireManager();
    const edition = await getActiveEdition();
    const input = overrideInputSchema.parse({
      participantPublicId: formData.get("participantPublicId"),
      zoneId: formData.get("zoneId"),
      reason: formData.get("reason"),
    });
    await service.grantOverride(edition.id, input, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return { message: "Exception accordée." };
}

export async function revokeOverrideAction(id: string): Promise<ActionState> {
  try {
    const session = await requireManager();
    await service.revokeOverride(id, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return {};
}
