"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import type { Permission } from "@/lib/permissions";
import * as service from "./service";

export interface BadgeActionState {
  error?: string;
  success?: string;
}

async function requireStaff(permission: Permission) {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, permission)) throw new Error("Permission insuffisante.");
  return { type: "USER" as const, userId: session.user.id };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

/** Génération (ou régénération à version constante) du badge courant. */
export async function generateBadgeAction(participantId: string): Promise<BadgeActionState> {
  try {
    const actor = await requireStaff("badges.generate");
    await service.generateBadge(participantId, actor);
    revalidatePath(`/admin/participants/${participantId}`);
    return { success: "Badge généré." };
  } catch (error) {
    return { error: message(error) };
  }
}

/**
 * Réémission : révoque le badge courant et en produit un de version+1.
 * L'ancien QR devient invalide immédiatement.
 */
export async function reissueBadgeAction(
  participantId: string,
  reason: string,
): Promise<BadgeActionState> {
  try {
    const actor = await requireStaff("badges.revoke");
    if (!reason.trim()) return { error: "Un motif de réémission est requis." };
    const badge = await service.reissueBadge(participantId, reason.trim(), actor);
    revalidatePath(`/admin/participants/${participantId}`);
    return { success: `Badge réémis en version ${badge.version}. L'ancien QR est invalidé.` };
  } catch (error) {
    return { error: message(error) };
  }
}

/** Révocation sans réémission (badge perdu, participant exclu). */
export async function revokeBadgeAction(
  badgeId: string,
  participantId: string,
  reason: string,
): Promise<BadgeActionState> {
  try {
    const actor = await requireStaff("badges.revoke");
    if (!reason.trim()) return { error: "Un motif de révocation est requis." };
    await service.revokeBadge(badgeId, reason.trim(), actor);
    revalidatePath(`/admin/participants/${participantId}`);
    return { success: "Badge révoqué." };
  } catch (error) {
    return { error: message(error) };
  }
}

/** Incrémente le compteur d'impressions (brief §5.4). */
export async function recordPrintAction(
  badgeId: string,
  participantId: string,
): Promise<BadgeActionState> {
  try {
    const actor = await requireStaff("badges.print");
    const badge = await service.recordPrint(badgeId, actor);
    revalidatePath(`/admin/participants/${participantId}`);
    return { success: `Impression enregistrée (${badge.printedCount} au total).` };
  } catch (error) {
    return { error: message(error) };
  }
}
