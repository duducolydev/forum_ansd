import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/modules/auth/magic-link";
import {
  PARTICIPANT_SESSION_COOKIE,
  participantSessionCookieOptions,
  signParticipantSession,
} from "@/modules/auth/participant-session";

/**
 * Consommation du lien magique. Route Handler et non page : le cookie de
 * session est posé explicitement sur la réponse de redirection.
 *
 * La redirection est relative — `NextResponse.redirect(new URL(…, request.url))`
 * reconstruirait l'URL à partir du `Host` interne du conteneur (0.0.0.0:3000)
 * et enverrait l'utilisateur sur un hôte injoignable derrière le reverse proxy.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const result = await consumeMagicLink(token);

  if (result.status !== "OK") {
    return redirectTo("/mon-espace?erreur=lien");
  }

  const response = redirectTo("/mon-espace");
  response.cookies.set(
    PARTICIPANT_SESSION_COOKIE,
    await signParticipantSession(result.participantId),
    participantSessionCookieOptions,
  );
  return response;
}
