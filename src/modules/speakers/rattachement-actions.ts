"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import type { ActionState } from "./actions";
import {
  modifierRattachement,
  rattacherSession,
  retirerSession,
  SpeakerRuleError,
} from "./service";

/**
 * Rattachement des intervenants aux sessions, depuis leur fiche (brief §5.8).
 *
 * Même permission que la fiche elle-même : composer le programme appartient au
 * gestionnaire programme, qui détient `speakers.write`.
 */

async function exigerEditeur() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "speakers.write")) throw new Error("Permission refusée.");
  return { type: "USER" as const, userId: session.user.id };
}

function messageErreur(error: unknown): string {
  if (error instanceof SpeakerRuleError) return error.message;
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

function invalider(speakerId: string, slug: string): void {
  revalidatePath("/admin/intervenants");
  revalidatePath(`/admin/intervenants/${speakerId}/modifier`);
  revalidatePath("/intervenants");
  revalidatePath("/programme");
  revalidatePath(`/programme/${slug}`);
}

export async function rattacherSessionAction(
  speakerId: string,
  sessionId: string,
  role: string,
): Promise<ActionState> {
  try {
    const actor = await exigerEditeur();
    const { slug, presentationAjoutee } = await rattacherSession(speakerId, sessionId, role, actor);
    invalider(speakerId, slug);
    return {
      message: presentationAjoutee
        ? "Intervenant ajouté à la session. Sa présentation a rejoint les contributions de la session, en brouillon."
        : "Intervenant ajouté à la session.",
    };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}

export async function modifierRattachementAction(
  speakerId: string,
  sessionId: string,
  role: string,
  statut: string,
): Promise<ActionState> {
  try {
    const actor = await exigerEditeur();
    const { slug } = await modifierRattachement(speakerId, sessionId, role, statut, actor);
    invalider(speakerId, slug);
    return { message: "Rattachement mis à jour." };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}

export async function retirerSessionAction(
  speakerId: string,
  sessionId: string,
): Promise<ActionState> {
  try {
    const actor = await exigerEditeur();
    const { slug, presentation } = await retirerSession(speakerId, sessionId, actor);
    invalider(speakerId, slug);
    return {
      message:
        presentation === "retiree"
          ? "Intervenant retiré de la session, avec sa présentation qui y était en brouillon."
          : presentation === "conservee"
            ? "Intervenant retiré de la session. Sa présentation y est en ligne : elle reste publiée, à retirer depuis l'écran Contributions si besoin."
            : "Intervenant retiré de la session.",
    };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}
