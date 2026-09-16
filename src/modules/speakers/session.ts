import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

/**
 * Session de l'espace intervenant (brief §5.8).
 *
 * Cookie **distinct** de celui des participants : un intervenant n'est pas
 * forcément inscrit au Forum, et surtout les deux espaces ne donnent pas accès
 * aux mêmes données. Partager le cookie aurait fait dépendre la séparation d'un
 * champ dans la charge utile plutôt que du cookie lui-même.
 *
 * Durée volontairement plus courte que les 30 jours de l'espace participant :
 * cet espace sert à déposer une bio et une présentation, en quelques visites
 * avant le Forum, pas à revenir tous les jours.
 */
export const SPEAKER_SESSION_COOKIE = "forum-speaker-session";
const SESSION_DAYS = 7;
export const SPEAKER_SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function secret(): Uint8Array {
  const value = process.env.MAGIC_LINK_SECRET;
  if (!value) {
    throw new Error("MAGIC_LINK_SECRET manquant : impossible de signer la session intervenant.");
  }
  return new TextEncoder().encode(value);
}

export const speakerSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SPEAKER_SESSION_MAX_AGE,
} as const;

export async function signSpeakerSession(speakerId: string): Promise<string> {
  return new SignJWT({ sid: speakerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function createSpeakerSession(speakerId: string): Promise<void> {
  const token = await signSpeakerSession(speakerId);
  (await cookies()).set(SPEAKER_SESSION_COOKIE, token, speakerSessionCookieOptions);
}

export async function getSpeakerSession(): Promise<{ speakerId: string } | null> {
  const token = (await cookies()).get(SPEAKER_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const speakerId = payload.sid;
    // `sid` et non `pid` : un jeton de session participant présenté ici ne doit
    // pas ouvrir l'espace intervenant, même s'il est signé du même secret.
    return typeof speakerId === "string" ? { speakerId } : null;
  } catch {
    return null;
  }
}

export async function clearSpeakerSession(): Promise<void> {
  (await cookies()).delete(SPEAKER_SESSION_COOKIE);
}
