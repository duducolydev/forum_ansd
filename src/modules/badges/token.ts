import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { parseBadgeToken, SIGNATURE_LENGTH } from "./token-format";

// Ré-export : les appelants existants continuent d'importer depuis `token.ts`.
export { parseBadgeToken, type ParsedBadgeToken } from "./token-format";

/**
 * Token QR du badge (brief §5.4) :
 *
 *     publicId + "." + base32(HMAC-SHA256(secret, publicId + version))[0:16]
 *
 * Le token est **auto-porteur** : un scanner hors ligne peut vérifier la
 * signature sans base de données. La base sert ensuite à connaître l'état
 * (révoqué, version courante) — cf. `verifyBadgeToken` dans le service.
 */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648, sans padding

function base32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function secret(): string {
  const value = process.env.BADGE_HMAC_SECRET;
  if (!value) {
    throw new Error("BADGE_HMAC_SECRET manquant : impossible de signer un badge.");
  }
  return value;
}

/** Partie signature du token, pour un `publicId` et une version donnés. */
export function badgeSignature(publicId: string, version: number): string {
  const mac = createHmac("sha256", secret()).update(`${publicId}${version}`).digest();
  return base32(mac).slice(0, SIGNATURE_LENGTH);
}

export function buildBadgeToken(publicId: string, version: number): string {
  return `${publicId}.${badgeSignature(publicId, version)}`;
}

/**
 * Empreinte stockée en base (`Badge.qrToken`). On ne conserve jamais le token
 * en clair : une fuite de la table ne permettrait pas de fabriquer un QR
 * valide sans le secret, mais elle permettrait de rejouer un badge existant.
 */
export function hashBadgeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Vérification de la signature en temps constant (pas de fuite par comparaison). */
export function verifyBadgeSignature(token: string, version: number): boolean {
  const parsed = parseBadgeToken(token);
  if (!parsed) return false;

  const expected = Buffer.from(badgeSignature(parsed.publicId, version));
  const provided = Buffer.from(parsed.signature);
  if (expected.length !== provided.length) return false;

  return timingSafeEqual(expected, provided);
}
