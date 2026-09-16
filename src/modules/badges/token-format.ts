/**
 * Format du token de badge, sans cryptographie.
 *
 * Ce fichier est séparé de `token.ts` parce qu'il doit être exécutable **dans
 * le navigateur** : le scanner hors ligne analyse le QR qu'il vient de lire, et
 * `token.ts` importe `node:crypto`. Réécrire l'analyse côté client aurait donné
 * deux implémentations d'une même règle de sécurité, qui auraient divergé.
 */
export const SIGNATURE_LENGTH = 16;

export interface ParsedBadgeToken {
  publicId: string;
  signature: string;
}

/** Découpage sans validation cryptographique (le `publicId` sert de clé de recherche). */
export function parseBadgeToken(token: string): ParsedBadgeToken | null {
  const trimmed = token.trim().toUpperCase();
  const separator = trimmed.lastIndexOf(".");
  if (separator <= 0 || separator === trimmed.length - 1) return null;

  const publicId = trimmed.slice(0, separator);
  const signature = trimmed.slice(separator + 1);
  if (signature.length !== SIGNATURE_LENGTH) return null;
  if (!/^[A-Z2-7]+$/.test(signature)) return null;

  return { publicId, signature };
}
