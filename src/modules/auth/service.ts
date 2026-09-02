import argon2 from "argon2";
import { prisma } from "@/lib/db";
import { verifyTotpCode } from "@/lib/totp";
import { audit } from "@/lib/audit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/** Rôles pour lesquels le 2FA TOTP est obligatoire (brief §7). */
export const ROLES_REQUIRING_TOTP = ["SUPER_ADMIN", "ADMIN_FORUM"] as const;

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  totpEnabled: boolean;
  /** Le rôle impose le 2FA mais il n'est pas encore activé : à rediriger vers l'enrôlement. */
  requiresTotpEnrollment: boolean;
}

export type AuthenticateResult =
  | { status: "OK"; user: AuthenticatedUser }
  | { status: "INVALID_CREDENTIALS" }
  | { status: "LOCKED"; lockedUntil: Date }
  | { status: "INACTIVE" }
  | { status: "TOTP_REQUIRED" }
  | { status: "TOTP_INVALID" };

/**
 * Authentifie un utilisateur BackOffice (brief §7) : hachage `argon2id`,
 * verrouillage après 5 échecs (15 min), vérification TOTP si activé.
 */
export async function authenticateUser(
  email: string,
  password: string,
  totpCode?: string,
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

  if (user.totpEnabled) {
    if (!totpCode) {
      return { status: "TOTP_REQUIRED" };
    }
    if (!user.totpSecret || !(await verifyTotpCode(user.totpSecret, totpCode))) {
      await registerFailedAttempt(user.id, user.failedAttempts);
      return { status: "TOTP_INVALID" };
    }
  }

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

  const permissions = (user.role.permissions as string[] | null) ?? [];

  return {
    status: "OK",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions,
      totpEnabled: user.totpEnabled,
      requiresTotpEnrollment:
        (ROLES_REQUIRING_TOTP as readonly string[]).includes(user.role.name) && !user.totpEnabled,
    },
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

/** Confirme l'enrôlement 2FA d'un utilisateur (secret déjà généré côté serveur). */
export async function enableTotp(userId: string, secret: string, code: string): Promise<boolean> {
  if (!(await verifyTotpCode(secret, code))) {
    return false;
  }
  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true, totpSecret: secret },
  });
  await audit.log({
    actorType: "USER",
    actorUserId: userId,
    action: "auth.totp_enabled",
    entity: "User",
    entityId: userId,
  });
  return true;
}
