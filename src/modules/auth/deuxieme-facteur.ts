import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getActiveEdition } from "@/lib/edition";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueNotification } from "@/modules/notifications/jobs";

/**
 * Second facteur des comptes BackOffice : validation par e-mail (PLAN.md §23).
 *
 * Remplace l'application d'authentification (TOTP) à la demande du
 * commanditaire. Le mot de passe vérifié, un message part vers l'adresse du
 * compte : il porte un **code à 6 chiffres**, à saisir dans la fenêtre où la
 * connexion a commencé, et un **lien de validation**, utile quand on lit son
 * courrier sur un autre appareil.
 *
 * Ce que ce facteur vaut, et ce qu'il ne vaut pas : la boîte mail de la personne
 * devient la clé du BackOffice. Qui y accède entre. Le TOTP, lui, tenait dans un
 * téléphone, hors ligne. Les garde-fous ci-dessous réduisent le reste du risque.
 */

/** Dix minutes : le temps d'aller chercher un message, pas celui d'une pause. */
const VALIDITE_MINUTES = 10;
/** Cinq essais par demande : 6 chiffres se devineraient sinon. */
const MAX_ESSAIS = 5;
/** Trois demandes par minute et par compte : un formulaire ne doit pas servir à inonder une boîte. */
const DEMANDES_PAR_MINUTE = 3;

export const VALIDITE_DEFI_MINUTES = VALIDITE_MINUTES;

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

function codesEgaux(attendu: string, saisi: string): boolean {
  const a = Buffer.from(attendu);
  const b = Buffer.from(saisi);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type DemandeDefi =
  { status: "ENVOYE" } | { status: "TROP_DE_DEMANDES"; retryAfterSeconds: number };

/**
 * Ouvre une demande de validation et met le message en file.
 *
 * Les demandes précédentes du même compte sont **annulées** : un seul code vaut
 * à la fois, sans quoi chaque demande ajouterait une chance de deviner.
 */
export async function creerDefi(
  utilisateur: { id: string; email: string; name: string },
  ip?: string,
): Promise<DemandeDefi> {
  const limite = await rateLimit(`admin-2fa:${utilisateur.id}`, DEMANDES_PAR_MINUTE, 60);
  if (!limite.allowed) {
    return { status: "TROP_DE_DEMANDES", retryAfterSeconds: limite.retryAfterSeconds };
  }

  const jeton = randomBytes(32).toString("base64url");
  const code6 = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await prisma.adminLoginChallenge.updateMany({
    where: { userId: utilisateur.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.adminLoginChallenge.create({
    data: {
      userId: utilisateur.id,
      tokenHash: empreinte(jeton),
      code6,
      expiresAt: new Date(Date.now() + VALIDITE_MINUTES * 60_000),
      ip,
    },
  });

  const edition = await getActiveEdition();
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  await enqueueNotification({
    editionId: edition.id,
    templateKey: "admin_login_code",
    to: utilisateur.email,
    variables: {
      nom: utilisateur.name,
      code6,
      lien_validation: `${baseUrl}/connexion/valider/${jeton}`,
      minutes: String(VALIDITE_MINUTES),
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: utilisateur.id,
    action: "auth.second_facteur_envoye",
    entity: "User",
    entityId: utilisateur.id,
    ip,
  });

  return { status: "ENVOYE" };
}

/** Demande en cours d'un compte : la dernière ouverte, non expirée. */
async function defiEnCours(userId: string) {
  return prisma.adminLoginChallenge.findFirst({
    where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Vérifie le code saisi. Consomme la demande en cas de succès, la referme au
 * cinquième échec : le code suivant devra être redemandé.
 */
export async function verifierCode(userId: string, code6: string): Promise<boolean> {
  const defi = await defiEnCours(userId);
  if (!defi) return false;

  if (!codesEgaux(defi.code6, code6)) {
    const apres = await prisma.adminLoginChallenge.update({
      where: { id: defi.id },
      data: { failedAttempts: { increment: 1 } },
    });
    if (apres.failedAttempts >= MAX_ESSAIS) {
      await prisma.adminLoginChallenge.updateMany({
        where: { id: defi.id, usedAt: null },
        data: { usedAt: new Date() },
      });
    }
    return false;
  }

  return consommer(defi.id);
}

/** Consomme le jeton du lien de validation et renvoie le compte concerné. */
export async function consommerJeton(jeton: string): Promise<string | null> {
  const defi = await prisma.adminLoginChallenge.findUnique({
    where: { tokenHash: empreinte(jeton) },
  });
  if (!defi || defi.usedAt || defi.expiresAt.getTime() < Date.now()) return null;
  return (await consommer(defi.id)) ? defi.userId : null;
}

/**
 * Marque la demande utilisée, **atomiquement** : deux requêtes simultanées ne
 * peuvent pas ouvrir deux sessions avec le même code.
 */
async function consommer(defiId: string): Promise<boolean> {
  const { count } = await prisma.adminLoginChallenge.updateMany({
    where: { id: defiId, usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}
