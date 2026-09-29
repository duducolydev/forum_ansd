import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { lireAccesDirect, signerAccesDirect } from "./acces-direct";
import { signParticipantSession } from "./participant-session";

describe("lien d'accès direct à « Mon espace »", () => {
  it("retrouve le participant à partir du lien signé", async () => {
    const jeton = await signerAccesDirect("participant-1");
    expect(await lireAccesDirect(jeton)).toBe("participant-1");
  });

  it("refuse un cookie de session présenté comme lien", async () => {
    // Même secret, mais pas le même type de jeton.
    const session = await signParticipantSession("participant-1");
    expect(await lireAccesDirect(session)).toBeNull();
  });

  it("refuse un jeton altéré", async () => {
    const jeton = await signerAccesDirect("participant-1");
    const altere = `${jeton.slice(0, -2)}${jeton.endsWith("A") ? "B" : "A"}A`;
    expect(await lireAccesDirect(altere)).toBeNull();
  });

  it("refuse un lien expiré", async () => {
    const secret = new TextEncoder().encode(process.env.MAGIC_LINK_SECRET!);
    const expire = await new SignJWT({ pid: "participant-1", typ: "acces" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);
    expect(await lireAccesDirect(expire)).toBeNull();
  });
});
