import { parseBadgeToken } from "@/modules/badges/token-format";

/**
 * Du contenu d'un QR à l'empreinte cherchée dans le manifeste.
 *
 * Le QR d'un badge encode l'URL publique de vérification (`…/v/<token>`), mais
 * l'empreinte stockée en base porte sur le **token seul**. On extrait donc le
 * token, on le normalise exactement comme le serveur (`parseBadgeToken`, code
 * partagé et non recopié), puis on le hache.
 */
const MOTIF_TOKEN = /[A-Za-z0-9-]+\.[A-Za-z2-7]{16}/g;

export function extraireToken(contenuQr: string): string | null {
  const correspondances = contenuQr.trim().match(MOTIF_TOKEN);
  if (!correspondances || correspondances.length === 0) return null;

  // La dernière occurrence : dans une URL, le token est en fin de chemin, et un
  // nom d'hôte contenant un point ne doit pas être pris pour un token.
  const analyse = parseBadgeToken(correspondances[correspondances.length - 1]!);
  return analyse ? `${analyse.publicId}.${analyse.signature}` : null;
}

/**
 * Empreinte SHA-256 du token, en hexadécimal — la même valeur que
 * `hashBadgeToken` côté serveur, d'où la comparaison directe avec le manifeste.
 *
 * `crypto.subtle` exige un contexte sécurisé : HTTPS en production, `localhost`
 * en développement. Un scanner servi en HTTP clair depuis une IP de réseau
 * local n'aurait ni cette API ni l'accès caméra — c'est un point à vérifier au
 * déploiement (cf. T1).
 */
export async function empreinteToken(token: string): Promise<string> {
  const octets = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(octets))
    .map((octet) => octet.toString(16).padStart(2, "0"))
    .join("");
}
