import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { creerCodeSecours } from "./magic-link";
import { accesEspace, type MotifRefusAcces } from "./acces-espace";

/**
 * Accès direct à « Mon espace » depuis un e-mail (demande du 29 septembre
 * 2026).
 *
 * Avant, l'e-mail de confirmation menait à la page « Mon espace », qui
 * redemandait l'adresse, renvoyait un second e-mail, dont le lien expirait en
 * 30 minutes. L'e-mail de confirmation (et celui du badge) porte désormais un
 * **lien signé** qui ouvre l'espace d'un clic, et un **code de secours**.
 *
 * Choix de conception :
 *
 * - **Lien signé, sans table** (JWT, secret `MAGIC_LINK_SECRET`) et
 *   **réutilisable pendant 14 jours**. Un lien à usage unique ne survivrait
 *   pas aux passerelles de messagerie d'entreprise, qui ouvrent les liens
 *   d'un message pour les analyser avant le destinataire — le lien serait
 *   consommé par l'antivirus. Il ne donne rien de plus que l'e-mail qui le
 *   porte : accéder à la boîte, c'est déjà pouvoir demander un lien.
 * - Le jeton porte un **type propre** (`acces`) : un cookie de session ne
 *   peut pas servir de lien, et inversement.
 * - Refusé pour un participant supprimé, annulé ou décliné : la signature ne
 *   suffit pas, l'état du dossier est relu à chaque usage.
 * - Le **code de secours** (7 jours) passe par le mécanisme existant des
 *   liens magiques : un seul code comparé à la fois, cinq erreurs l'annulent.
 */

const JOURS_LIEN = 14;
const JOURS_CODE = 7;
const TYPE = "acces";

function secret(): Uint8Array {
  const valeur = process.env.MAGIC_LINK_SECRET;
  if (!valeur)
    throw new Error("MAGIC_LINK_SECRET manquant : impossible de signer le lien d'accès.");
  return new TextEncoder().encode(valeur);
}

export async function signerAccesDirect(participantId: string): Promise<string> {
  return new SignJWT({ pid: participantId, typ: TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${JOURS_LIEN}d`)
    .sign(secret());
}

/** Identifiant du participant si le jeton est un lien d'accès valide, sinon `null`. */
export async function lireAccesDirect(jeton: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(jeton, secret());
    if (payload.typ !== TYPE || typeof payload.pid !== "string") return null;
    return payload.pid;
  } catch {
    return null;
  }
}

export type AccesDirectResultat =
  | { statut: "OK"; participantId: string }
  | { statut: "REFUSE"; motif: MotifRefusAcces }
  | { statut: "INVALIDE" };

/**
 * Vérifie un lien d'accès et le dossier qu'il désigne.
 *
 * La liste des statuts fermés vivait ici en double de celle du lien magique
 * (16 novembre 2026) : les deux portes n'auraient pas tardé à diverger. La
 * règle est maintenant celle de `acces-espace.ts`, et un refus porte son motif
 * — « annulée » et « en attente de validation » ne se disent pas pareil.
 */
export async function consommerAccesDirect(jeton: string): Promise<AccesDirectResultat> {
  const participantId = await lireAccesDirect(jeton);
  if (!participantId) return { statut: "INVALIDE" };

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: {
      deletedAt: true,
      status: true,
      category: { select: { requiresAccreditation: true } },
    },
  });
  if (!participant || participant.deletedAt) return { statut: "INVALIDE" };

  const acces = accesEspace(participant);
  if (!acces.autorise) return { statut: "REFUSE", motif: acces.motif };

  await audit.log({
    actorType: "PARTICIPANT",
    actorParticipantId: participantId,
    action: "participant.direct_access",
    entity: "Participant",
    entityId: participantId,
  });
  return { statut: "OK", participantId };
}

/**
 * Variables d'accès à glisser dans un e-mail : `lien_espace` (lien direct) et,
 * si demandé, `code6` (code de secours).
 */
export async function variablesAccesDirect(
  participantId: string,
  options: { avecCode: boolean },
): Promise<{ lien_espace: string; code6?: string }> {
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const lien = `${baseUrl}/mon-espace/acces/${await signerAccesDirect(participantId)}`;
  if (!options.avecCode) return { lien_espace: lien };
  return { lien_espace: lien, code6: await creerCodeSecours(participantId, JOURS_CODE) };
}
