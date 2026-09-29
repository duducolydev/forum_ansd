import { NextResponse } from "next/server";
import { consommerAccesDirect } from "@/modules/auth/acces-direct";
import {
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
  const participantId = await consommerAccesDirect(jeton);
  if (!participantId) return redirectTo("/mon-espace?erreur=lien");

  const response = redirectTo("/mon-espace");
  response.cookies.set(
    PARTICIPANT_SESSION_COOKIE,
    await signParticipantSession(participantId),
    participantSessionCookieOptions,
  );
  return response;
}
