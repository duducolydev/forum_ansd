"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { prisma } from "@/lib/db";
import * as service from "./service";
import { invitationInputSchema, reminderFiltersSchema } from "./schema";

export interface ActionState {
  error?: string;
  success?: string;
}

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  return session;
}

function firstFieldError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export async function createInvitationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "invitations.write")) return { error: "Permission refusée." };

    const input = invitationInputSchema.parse({
      email: formData.get("email"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      organization: formData.get("organization") ?? undefined,
      country: formData.get("country") ?? undefined,
      categoryId: formData.get("categoryId"),
    });

    const edition = await getActiveEdition();
    await service.createInvitation(edition.id, input, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }

  revalidatePath("/admin/invitations");
  return {};
}

export async function sendInvitationAction(invitationId: string): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "invitations.send")) return { error: "Permission refusée." };
    await service.sendInvitation(invitationId, { type: "USER", userId: session.user.id });
  } catch (error) {
    return { error: firstFieldError(error) };
  }
  revalidatePath("/admin/invitations");
  return {};
}

export async function sendRemindersAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "invitations.send")) return { error: "Permission refusée." };

    const filters = reminderFiltersSchema.parse({
      categoryId: formData.get("categoryId") ?? undefined,
      country: formData.get("country") ?? undefined,
    });

    const edition = await getActiveEdition();
    const { queued } = await service.sendReminders(edition.id, filters, {
      type: "USER",
      userId: session.user.id,
    });

    revalidatePath("/admin/invitations");
    return { success: `${queued} relance(s) mise(s) en file.` };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}

export interface ImportPreviewState {
  batchToken?: string;
  validCount?: number;
  errors?: { rowNumber: number; message: string }[];
  error?: string;
}

/** Étape 1 : upload + prévisualisation (rien n'est écrit en base). */
export async function previewImportAction(
  _prevState: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  try {
    const session = await requireSession();
    if (!can(session, "invitations.write")) return { error: "Permission refusée." };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Aucun fichier sélectionné." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: "Fichier trop volumineux (5 Mo maximum)." };
    }

    const edition = await getActiveEdition();
    const categories = await prisma.participantCategory.findMany({
      where: { editionId: edition.id },
    });
    const categoryCodeToId = new Map(categories.map((category) => [category.code, category.id]));

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = service.parseImportFile(buffer);
    const preview = await service.previewImport(edition.id, rows, categoryCodeToId);

    // Le batch validé est repassé au client (form caché) plutôt que stocké en
    // mémoire serveur : chaque instance de l'app pourrait sinon perdre l'état
    // entre la prévisualisation et la confirmation (pas d'affinité de requête).
    const batchToken = Buffer.from(JSON.stringify(preview.valid)).toString("base64");

    return {
      batchToken,
      validCount: preview.valid.length,
      errors: preview.errors,
    };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}

/** Étape 2 : confirmation — écrit les lignes déjà validées. */
export async function confirmImportAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireSession();
    if (!can(session, "invitations.write")) return { error: "Permission refusée." };

    const batchToken = String(formData.get("batchToken") ?? "");
    if (!batchToken) return { error: "Session d'import expirée, veuillez réimporter le fichier." };

    const rows = JSON.parse(Buffer.from(batchToken, "base64").toString("utf-8"));

    const edition = await getActiveEdition();
    const categories = await prisma.participantCategory.findMany({
      where: { editionId: edition.id },
    });
    const categoryCodeToId = new Map(categories.map((category) => [category.code, category.id]));

    const summary = await service.importInvitations(edition.id, rows, categoryCodeToId, {
      type: "USER",
      userId: session.user.id,
    });

    revalidatePath("/admin/invitations");
    return { success: `${summary.imported} invitation(s) importée(s).` };
  } catch (error) {
    return { error: firstFieldError(error) };
  }
}
