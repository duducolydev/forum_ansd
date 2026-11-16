import { NextResponse } from "next/server";
import { consommerAccesDirect } from "@/modules/auth/acces-direct";
import {
  COMPTE_CONNU_COOKIE,
  compteConnuCookieOptions,
  PARTICIPANT_SESSION_COOKIE,
  participantSessionCookieOptions,
  signParticipantSession,
} from "@/modules/auth/participant-session";

/**
 * Lien d'accès direct des e-mails de confirmation et de badge
 * (`acces-direct.ts`) : ouvre la session et mène à « Mon espace ».
 *
 * Route Handler, comme le lien magique : le cookie est posé sur la réponse de
 * redirection, et la redirection est relative (cf. `lien/[token]/route.ts`).
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jeton: string }> },
): Promise<NextResponse> {
  const { jeton } = await params;
  const resultat = await consommerAccesDirect(jeton);

  // Dossier annulé ou pas encore validé : le lien est bon, c'est la porte qui
  // est fermée. Le dire évite un « lien expiré » qui n'apprend rien.
  if (resultat.statut === "REFUSE") {
    return redirectTo(`/mon-espace?refus=${resultat.motif}`);
  }
  if (resultat.statut !== "OK") return redirectTo("/mon-espace?erreur=lien");

  const response = redirectTo("/mon-espace");
  response.cookies.set(
    PARTICIPANT_SESSION_COOKIE,
    await signParticipantSession(resultat.participantId),
    participantSessionCookieOptions,
  );
  response.cookies.set(COMPTE_CONNU_COOKIE, "1", compteConnuCookieOptions);
  return response;
}
