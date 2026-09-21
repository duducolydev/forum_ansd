import { NextResponse } from "next/server";
import { getActiveEdition } from "@/lib/edition";
import { rateLimit } from "@/lib/rate-limit";
import { getParticipantSession } from "@/modules/auth/participant-session";
import { annuler, inscrire, RefusInscription } from "@/modules/sessions/registration";
import { enqueueNotification } from "@/modules/notifications/jobs";

export const dynamic = "force-dynamic";

/**
 * Réservation d'une session par un participant (brief §5.5).
 *
 * L'authentification passe par la session « Mon espace » (lien magique),
 * pas par le BackOffice : c'est le participant lui-même qui réserve.
 */
const CODES: Record<string, number> = {
  SESSION_INTROUVABLE: 404,
  RESERVATION_FERMEE: 409,
  ECHEANCE_PASSEE: 409,
  PARTICIPANT_NON_CONFIRME: 403,
  DEJA_INSCRIT: 409,
  CHEVAUCHEMENT: 409,
  COMPLET: 409,
};

function versReponse(erreur: unknown): NextResponse {
  if (erreur instanceof RefusInscription) {
    return NextResponse.json(
      { error: erreur.message, motif: erreur.motif, detail: erreur.detail },
      { status: CODES[erreur.motif] ?? 400 },
    );
  }
  throw erreur;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: "Connectez-vous à votre espace." }, { status: 401 });
  }

  // Une place se prend en une requête : un client qui en envoie trente en une
  // minute n'essaie pas de réserver, il sonde la disponibilité.
  const limite = await rateLimit(`session-register:${session.participantId}`, 10, 60);
  if (!limite.allowed) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez dans un instant." },
      {
        status: 429,
      },
    );
  }

  const { id } = await params;
  try {
    const resultat = await inscrire(id, session.participantId);
    return NextResponse.json(resultat);
  } catch (erreur) {
    return versReponse(erreur);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getParticipantSession();
  if (!session) {
    return NextResponse.json({ error: "Connectez-vous à votre espace." }, { status: 401 });
  }

  const { id } = await params;
  try {
    const resultat = await annuler(id, session.participantId);

    // La notification part **après** le commit, et par la file : une place
    // annoncée depuis une transaction qui échouerait ensuite serait un
    // courriel à démentir.
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

    return NextResponse.json({ promu: resultat.promu !== null });
  } catch (erreur) {
    return versReponse(erreur);
  }
}
