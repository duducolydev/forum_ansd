import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Session participant (décision PLAN.md C2) : le `MagicLink` est à usage unique
 * et expire en 30 minutes ; une fois consommé, on émet un cookie JWT httpOnly
 * signé, à durée glissante, plutôt que d'ajouter une table de sessions.
 */
export const PARTICIPANT_SESSION_COOKIE = "forum-participant-session";
const SESSION_DAYS = 30;
export const PARTICIPANT_SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

function secret(): Uint8Array {
  const value = process.env.MAGIC_LINK_SECRET;
  if (!value) {
    throw new Error("MAGIC_LINK_SECRET manquant : impossible de signer la session participant.");
  }
  return new TextEncoder().encode(value);
}

/** Options communes au `cookies().set()` et au `NextResponse.cookies.set()`. */
export const participantSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: PARTICIPANT_SESSION_MAX_AGE,
} as const;

export async function signParticipantSession(participantId: string): Promise<string> {
  return new SignJWT({ pid: participantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function createParticipantSession(participantId: string): Promise<void> {
  const token = await signParticipantSession(participantId);
  (await cookies()).set(PARTICIPANT_SESSION_COOKIE, token, participantSessionCookieOptions);
}

export async function getParticipantSession(): Promise<{ participantId: string } | null> {
  const token = (await cookies()).get(PARTICIPANT_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    const participantId = typeof payload.pid === "string" ? payload.pid : null;
    return participantId ? { participantId } : null;
  } catch {
    // Jeton expiré, altéré ou signé avec un autre secret : session invalide.
    return null;
  }
}

export async function clearParticipantSession(): Promise<void> {
  (await cookies()).delete(PARTICIPANT_SESSION_COOKIE);
}
