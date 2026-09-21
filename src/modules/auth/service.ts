import argon2 from "argon2";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { consommerJeton, creerDefi, verifierCode } from "./deuxieme-facteur";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Rôles soumis au second facteur (cahier des charges ANSD §26 : « authentification
 * à deux facteurs pour les administrateurs »).
 *
 * Le facteur est une **validation par e-mail** depuis le §23 : code à 6 chiffres
 * et lien, envoyés à l'adresse du compte. Il remplace l'application
 * d'authentification (TOTP) prévue au brief §7, à la demande du commanditaire.
 */
export const ROLES_A_DEUX_FACTEURS = ["SUPER_ADMIN", "ADMIN_FORUM"] as const;

export function exigeSecondFacteur(roleName: string): boolean {
  return (ROLES_A_DEUX_FACTEURS as readonly string[]).includes(roleName);
}

/** Ce que la session porte des droits d'un compte. */
export interface DroitsDuCompte {
  roleId: string;
  roleName: string;
  permissions: string[];
  /** Version de session du compte au moment où le jeton a été émis (PLAN.md §18). */
  sessionVersion: number;
}

export interface AuthenticatedUser extends DroitsDuCompte {
  id: string;
  email: string;
  name: string;
}

/**
 * Droits d'un compte tels que la session les porte.
 *
 * Un seul calcul, pour la connexion **et** pour la revalidation de chaque
 * session (`revalidation.ts`) : deux calculs séparés finiraient par diverger, et
 * une session revalidée n'aurait plus les droits qu'aurait une connexion neuve.
 */
export function droitsDuCompte(user: {
  roleId: string;
  sessionVersion: number;
  role: { name: string; permissions: unknown };
}): DroitsDuCompte {
  return {
    roleId: user.roleId,
    roleName: user.role.name,
    permissions: (user.role.permissions as string[] | null) ?? [],
    sessionVersion: user.sessionVersion,
  };
}

export type AuthenticateResult =
  | { status: "OK"; user: AuthenticatedUser }
  | { status: "INVALID_CREDENTIALS" }
  | { status: "LOCKED"; lockedUntil: Date }
  | { status: "INACTIVE" }
  /** Mot de passe accepté : un code vient de partir vers l'adresse du compte. */
  | { status: "CODE_SENT" }
  | { status: "CODE_INVALID" }
  | { status: "CODE_THROTTLED"; retryAfterSeconds: number };

/**
 * Authentifie un compte BackOffice : hachage `argon2id`, verrouillage après cinq
 * échecs (15 min), puis **second facteur par e-mail** pour les rôles qui y sont
 * soumis (PLAN.md §23).
 */
export async function authenticateUser(
  email: string,
  password: string,
  code?: string,
  ip?: string,
): Promise<AuthenticateResult> {
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });

  if (!user) {
    // Temps de réponse constant, même sans compte, pour ne pas révéler son existence.
    await argon2.hash(password, { type: argon2.argon2id }).catch(() => undefined);
    return { status: "INVALID_CREDENTIALS" };
  }

  if (!user.isActive) {
    return { status: "INACTIVE" };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { status: "LOCKED", lockedUntil: user.lockedUntil };
  }

  const passwordValid = await argon2.verify(user.passwordHash, password).catch(() => false);

  if (!passwordValid) {
    await registerFailedAttempt(user.id, user.failedAttempts);
    return { status: "INVALID_CREDENTIALS" };
  }

  if (exigeSecondFacteur(user.role.name)) {
    if (!code) {
      const envoi = await creerDefi(user, ip);
      return envoi.status === "ENVOYE"
        ? { status: "CODE_SENT" }
        : { status: "CODE_THROTTLED", retryAfterSeconds: envoi.retryAfterSeconds };
    }
    if (!(await verifierCode(user.id, code))) {
      // Un code faux compte comme un échec de connexion : cinq essais, puis le
      // compte se verrouille, comme pour un mot de passe.
      await registerFailedAttempt(user.id, user.failedAttempts);
      return { status: "CODE_INVALID" };
    }
  }

  return ouvrirSession(user);
}

/**
 * Connexion par le **lien** reçu par e-mail : le jeton vaut le code, puisqu'il
 * n'a été créé qu'après un mot de passe correct.
 */
export async function authenticateByChallenge(jeton: string): Promise<AuthenticateResult> {
  const userId = await consommerJeton(jeton);
  if (!userId) return { status: "CODE_INVALID" };

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user) return { status: "INVALID_CREDENTIALS" };
  if (!user.isActive) return { status: "INACTIVE" };
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { status: "LOCKED", lockedUntil: user.lockedUntil };
  }

  return ouvrirSession(user);
}

/** Dernière étape, commune aux deux chemins : compteurs remis à zéro et trace. */
async function ouvrirSession(user: {
  id: string;
  email: string;
  name: string;
  roleId: string;
  sessionVersion: number;
  role: { name: string; permissions: unknown };
}): Promise<AuthenticateResult> {
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: user.id,
    action: "auth.login",
    entity: "User",
    entityId: user.id,
  });

  return {
    status: "OK",
    user: { id: user.id, email: user.email, name: user.name, ...droitsDuCompte(user) },
  };
}

async function registerFailedAttempt(userId: string, currentFailedAttempts: number): Promise<void> {
  const failedAttempts = currentFailedAttempts + 1;
  const lockedUntil =
    failedAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS) : null;

  await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts, lockedUntil },
  });

  if (lockedUntil) {
    await audit.log({
      actorType: "USER",
      actorUserId: userId,
      action: "auth.locked",
      entity: "User",
      entityId: userId,
    });
  }
}
