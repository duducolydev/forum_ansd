import { NextResponse } from "next/server";
import { consumeSpeakerLink } from "@/modules/auth/magic-link";
import {
  signSpeakerSession,
  speakerSessionCookieOptions,
  SPEAKER_SESSION_COOKIE,
} from "@/modules/speakers/session";

/**
 * Consommation du lien d'accès intervenant.
 *
 * Route handler et non page : seuls les handlers et les actions peuvent poser
 * un cookie. La redirection est **relative** — construire une URL absolue à
 * partir de `request.url` renverrait vers `0.0.0.0:3000` derrière le proxy.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const resultat = await consumeSpeakerLink(token);

  if (resultat.status !== "OK") {
    return new NextResponse(null, {
      status: 303,
      headers: { Location: "/espace-intervenant?lien=invalide" },
    });
  }

  const reponse = new NextResponse(null, {
    status: 303,
    headers: { Location: "/espace-intervenant" },
  });
  reponse.cookies.set(
    SPEAKER_SESSION_COOKIE,
    await signSpeakerSession(resultat.speakerId),
    speakerSessionCookieOptions,
  );
  return reponse;
}
