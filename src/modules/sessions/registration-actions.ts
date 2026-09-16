"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { enqueueNotification } from "@/modules/notifications/jobs";
import { annuler, inscrire, marquerPresent, RefusInscription } from "./registration";

export interface ActionState {
  error?: string;
  message?: string;
}

async function requireGestion() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "registrations.manage")) throw new Error("Permission refusée.");
  return session;
}

function messageErreur(error: unknown): string {
  if (error instanceof RefusInscription) return error.message;
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

/**
 * Inscription manuelle par le comité (brief §5.5).
 *
 * Le participant est désigné par son identifiant public, celui qui figure sur
 * son badge : c'est ce que l'agent a sous les yeux au moment où quelqu'un
 * demande à être placé.
 */
export async function inscrireManuellementAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireGestion();
    const sessionId = String(formData.get("sessionId"));
    const publicId = String(formData.get("publicId") ?? "")
      .trim()
      .toUpperCase();

    const edition = await getActiveEdition();
    const participant = await prisma.participant.findFirst({
      where: { editionId: edition.id, publicId, deletedAt: null },
      select: { id: true },
    });
    if (!participant) {
      return { error: `Aucun participant avec l'identifiant ${publicId}.` };
    }

    // `parPersonnel` : le comité n'est arrêté ni par l'échéance ni par le quota
    // VIP, qui existent pour encadrer le libre-service.
    const resultat = await inscrire(sessionId, participant.id, {
      parPersonnel: true,
      actorUserId: session.user.id,
    });

    revalidatePath(`/admin/sessions/${sessionId}/inscriptions`);
    return {
      message:
        resultat.statut === "INSCRIT"
          ? "Participant inscrit."
          : `Participant placé en liste d'attente (position ${resultat.position}).`,
    };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}

export async function retirerAction(
  sessionId: string,
  participantId: string,
): Promise<ActionState> {
  try {
    const session = await requireGestion();
    const resultat = await annuler(sessionId, participantId, {
      parPersonnel: true,
      actorUserId: session.user.id,
    });

    if (resultat.promu) {
      const edition = await getActiveEdition();
      await enqueueNotification({
        editionId: edition.id,
        templateKey: "session_promoted",
        to: resultat.promu.email,
        participantId: resultat.promu.participantId,
        variables: { session: resultat.promu.sessionTitre },
      });
    }

    revalidatePath(`/admin/sessions/${sessionId}/inscriptions`);
    return {
      message: resultat.promu
        ? "Retiré. La première personne en attente a été promue et prévenue."
        : "Retiré.",
    };
  } catch (error) {
    return { error: messageErreur(error) };
  }
}

export async function marquerPresentAction(
  sessionId: string,
  participantId: string,
  present: boolean,
): Promise<ActionState> {
  try {
    const session = await requireGestion();
    await marquerPresent(sessionId, participantId, present, session.user.id);
    revalidatePath(`/admin/sessions/${sessionId}/inscriptions`);
    return {};
  } catch (error) {
    return { error: messageErreur(error) };
  }
}
