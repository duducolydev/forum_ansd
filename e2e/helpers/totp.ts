import { createHmac, randomBytes } from "node:crypto";

/**
 * TOTP (RFC 6238) réimplémenté pour les tests.
 *
 * Deux raisons. La première est pratique : le chargeur TypeScript de Playwright
 * résout `otplib` vers ses **sources** `.ts` et échoue à l'import.
 *
 * La seconde est meilleure : le test valide ainsi la 2FA du portail contre une
 * implémentation **indépendante** de la norme. Réutiliser la même bibliothèque
 * des deux côtés n'aurait vérifié que sa cohérence avec elle-même — un défaut
 * de cette bibliothèque serait passé inaperçu.
 */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let sortie = "";
  for (const octet of bytes) {
    value = (value << 8) | octet;
    bits += 8;
    while (bits >= 5) {
      sortie += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) sortie += BASE32[(value << (5 - bits)) & 31];
  return sortie;
}

function base32Decode(entree: string): Buffer {
  let bits = 0;
  let value = 0;
  const octets: number[] = [];
  for (const caractere of entree.toUpperCase().replace(/=+$/, "")) {
    const index = BASE32.indexOf(caractere);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      octets.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(octets);
}

/** Secret partagé, au format base32 attendu par les applications d'authentification. */
export function genererSecret(octets = 20): string {
  return base32Encode(randomBytes(octets));
}

/** Code à 6 chiffres pour l'instant présent (SHA-1, pas de 30 s — les défauts de la norme). */
export function codeTotp(secret: string, instant: number = Date.now()): string {
  const compteur = Math.floor(instant / 1000 / 30);
  const tampon = Buffer.alloc(8);
  tampon.writeBigUInt64BE(BigInt(compteur));

  const empreinte = createHmac("sha1", base32Decode(secret)).update(tampon).digest();
  // Troncature dynamique : les 4 derniers bits désignent l'offset de lecture.
  const offset = empreinte[empreinte.length - 1]! & 0x0f;
  const code = empreinte.readUInt32BE(offset) & 0x7fffffff;
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Secondes restantes avant le prochain pas. Sert à éviter de saisir un code
 * juste avant qu'il n'expire — sinon le test échoue une fois sur cinquante,
 * et un test qui échoue au hasard finit par être ignoré.
 */
export function secondesAvantRotation(instant: number = Date.now()): number {
  return 30 - (Math.floor(instant / 1000) % 30);
}
