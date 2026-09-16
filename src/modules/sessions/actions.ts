"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { fileStorage } from "@/lib/storage";
import * as service from "./service";
import { roomInputSchema, sessionInputSchema, TDR_MAX_BYTES } from "./schema";

export interface ActionState {
  error?: string;
  message?: string;
}

async function requireEditor() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "sessions.write")) throw new Error("Permission refusée.");
  return session;
}

function firstFieldError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

function refresh(slug?: string) {
  revalidatePath("/admin/sessions");
  revalidatePath("/programme");
  if (slug) revalidatePath(`/programme/${slug}`);
}

function lireSession(formData: FormData) {
  return sessionInputSchema.parse({
    slug: formData.get("slug") ?? undefined,
    type: formData.get("type"),
    number: formData.get("number") || undefined,
    titleFr: formData.get("titleFr"),
    titleEn: formData.get("titleEn") ?? undefined,
    descriptionFr: formData.get("descriptionFr") ?? undefined,
    descriptionEn: formData.get("descriptionEn") ?? undefined,
    objectives: formData.get("objectives") ?? undefined,
    theme: formData.get("theme") ?? undefined,
    day: formData.get("day"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    roomId: formData.get("roomId") ?? undefined,
    capacity: formData.get("capacity") || undefined,
    registrationOpen: formData.get("registrationOpen") === "on",
    registrationDeadline: formData.get("registrationDeadline") ?? undefined,
    waitlistEnabled: formData.get("waitlistEnabled") === "on",
    vipQuota: formData.get("vipQuota") || undefined,
    liveStreamUrl: formData.get("liveStreamUrl") ?? undefined,
    isPublished: formData.get("isPublished") === "on",
  });
}

export async function saveSessionAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string | undefined;
  try {
    const session = await requireEditor();
    const actor = { type: "USER" as const, userId: session.user.id };
    const edition = await getActiveEdition();
    const input = lireSession(formData);

    const id = formData.get("id");
    const enregistree =
      typeof id === "string" && id.length > 0
        ? await service.updateSession(edition.id, id, input, actor)
        : await service.createSession(edition.id, input, actor);
    slug = enregistree.slug;
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh(slug);
  return { message: "Session enregistrée." };
}

export async function duplicateSessionAction(id: string): Promise<ActionState> {
  try {
    const session = await requireEditor();
    const edition = await getActiveEdition();
    await service.duplicateSession(edition.id, id, {
      type: "USER",
      userId: session.user.id,
    });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return {};
}

export async function togglePublishedAction(
  id: string,
  isPublished: boolean,
): Promise<ActionState> {
  try {
    const session = await requireEditor();
    await service.setPublished(id, isPublished, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return {};
}

export async function deleteSessionAction(id: string): Promise<ActionState> {
  try {
    const session = await requireEditor();
    await service.deleteSession(id, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Termes de référence
// ---------------------------------------------------------------------------

/**
 * Dépôt des TDR (brief §5.8).
 *
 * Le type est déduit des **octets du fichier** et non de l'extension ni du
 * `Content-Type` annoncé : un exécutable renommé en `.pdf` ne doit pas devenir
 * un document téléchargeable depuis le site public. Seul le PDF est accepté —
 * c'est le format d'un document destiné à être lu et imprimé tel quel.
 */
export async function uploadTdrAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireEditor();
    const id = String(formData.get("id"));
    const fichier = formData.get("tdr");

    if (!(fichier instanceof File) || fichier.size === 0) {
      return { error: "Aucun fichier sélectionné." };
    }
    if (fichier.size > TDR_MAX_BYTES) {
      return { error: `Fichier trop lourd (maximum ${TDR_MAX_BYTES / 1024 / 1024} Mo).` };
    }

    const octets = Buffer.from(await fichier.arrayBuffer());
    if (octets.subarray(0, 4).toString("ascii") !== "%PDF") {
      return { error: "Seuls les fichiers PDF sont acceptés." };
    }

    const chemin = `tdr/${id}-${randomBytes(6).toString("hex")}.pdf`;
    await fileStorage.put(chemin, octets, "application/pdf");

    const avant = await service.getSession(id);
    await service.setTdrPath(id, chemin, { type: "USER", userId: session.user.id });
    if (avant?.tdrPath && avant.tdrPath !== chemin) {
      await fileStorage.delete(avant.tdrPath).catch(() => undefined);
    }

    refresh(avant?.slug);
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  return { message: "TDR déposé." };
}

export async function removeTdrAction(id: string): Promise<ActionState> {
  try {
    const session = await requireEditor();
    const avant = await service.getSession(id);
    if (!avant?.tdrPath) return {};

    await service.setTdrPath(id, null, { type: "USER", userId: session.user.id });
    await fileStorage.delete(avant.tdrPath).catch(() => undefined);
    refresh(avant.slug);
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  return {};
}

// ---------------------------------------------------------------------------
// Salles
// ---------------------------------------------------------------------------

export async function saveRoomAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireEditor();
    const actor = { type: "USER" as const, userId: session.user.id };
    const input = roomInputSchema.parse({
      name: formData.get("name"),
      capacity: formData.get("capacity") || undefined,
      floor: formData.get("floor") ?? undefined,
    });

    const id = formData.get("id");
    if (typeof id === "string" && id.length > 0) {
      await service.updateRoom(id, input, actor);
    } else {
      const edition = await getActiveEdition();
      await service.createRoom(edition.id, input, actor);
    }
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return { message: "Salle enregistrée." };
}

export async function deleteRoomAction(id: string): Promise<ActionState> {
  try {
    const session = await requireEditor();
    await service.deleteRoom(id, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  refresh();
  return {};
}
