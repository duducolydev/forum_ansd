import argon2 from "argon2";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { ROLES_REQUIRING_TOTP } from "@/modules/auth/service";
import type { CreationUtilisateur, ModificationUtilisateur } from "./schema";

/** Erreur de règle métier : message destiné à l'écran, pas à la console. */
export class UtilisateurRuleError extends Error {}

export interface Acteur {
  userId: string;
}

/*
 * Un compte BackOffice ne se supprime pas, il se désactive.
 *
 * `AuditLog.actorUserId` référence `User` : supprimer un compte qui a agi
 * effacerait le lien entre les traces et leur auteur, c'est-à-dire exactement
 * ce que le journal existe pour conserver. La désactivation coupe l'accès
 * (`authenticateUser` renvoie INACTIVE, et les sessions ouvertes sont fermées —
 * §18) sans toucher à l'historique.
 */

export async function listerRoles() {
  return prisma.role.findMany({ orderBy: { name: "asc" } });
}

export async function listerUtilisateurs() {
  return prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      totpEnabled: true,
      lastLoginAt: true,
      lockedUntil: true,
      failedAttempts: true,
      createdAt: true,
      role: { select: { id: true, name: true, permissions: true } },
    },
  });
}

export async function trouverUtilisateur(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      totpEnabled: true,
      lastLoginAt: true,
      lockedUntil: true,
      createdAt: true,
      role: { select: { id: true, name: true, permissions: true } },
    },
  });
}

/** Le rôle impose-t-il un second facteur (brief §7) ? */
export function exigeDeuxFacteurs(roleName: string): boolean {
  return (ROLES_REQUIRING_TOTP as readonly string[]).includes(roleName);
}

/**
 * Nombre de comptes actifs capables de gérer les utilisateurs.
 *
 * Sert de garde-fou : si ce nombre tombe à zéro, plus personne ne peut créer,
 * réactiver ni changer le rôle de quiconque, et la seule issue est une
 * intervention en base. Aucune opération de cet écran n'a le droit d'y mener.
 */
async function compterAdministrateursActifs(saufUserId?: string): Promise<number> {
  const roles = await prisma.role.findMany({ select: { id: true, permissions: true } });
  const rolesAdmin = roles
    .filter((role) => ((role.permissions as string[] | null) ?? []).includes("users.manage"))
    .map((role) => role.id);
  if (rolesAdmin.length === 0) return 0;

  return prisma.user.count({
    where: {
      roleId: { in: rolesAdmin },
      isActive: true,
      ...(saufUserId ? { id: { not: saufUserId } } : {}),
    },
  });
}

async function garderUnAdministrateur(userId: string, message: string): Promise<void> {
  if ((await compterAdministrateursActifs(userId)) === 0) {
    throw new UtilisateurRuleError(message);
  }
}

export async function creerUtilisateur(input: CreationUtilisateur, acteur: Acteur) {
  const existant = await prisma.user.findUnique({ where: { email: input.email } });
  if (existant) {
    throw new UtilisateurRuleError("Un compte existe déjà avec cette adresse.");
  }

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new UtilisateurRuleError("Rôle inconnu.");

  const utilisateur = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      roleId: role.id,
      passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
      isActive: true,
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "user.created",
    entity: "User",
    entityId: utilisateur.id,
    // Jamais le mot de passe ni son empreinte : le journal est consultable.
    after: { email: utilisateur.email, name: utilisateur.name, role: role.name },
  });

  return utilisateur;
}

export async function modifierUtilisateur(
  userId: string,
  input: ModificationUtilisateur,
  acteur: Acteur,
) {
  const avant = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { name: true } } },
  });
  if (!avant) throw new UtilisateurRuleError("Compte introuvable.");

  if (userId === acteur.userId) {
    /*
     * On ne modifie pas son propre rôle ni son propre état depuis cet écran.
     *
     * Les droits sont relus à chaque requête (PLAN.md §18) : se retirer un rôle
     * ou se désactiver prendrait effet aussitôt et fermerait l'écran à la
     * personne en train de s'en servir, sans retour possible. C'est à un autre
     * gestionnaire de le faire.
     */
    if (input.roleId !== avant.roleId) {
      throw new UtilisateurRuleError("Vous ne pouvez pas changer votre propre rôle.");
    }
    if (!input.isActive) {
      throw new UtilisateurRuleError("Vous ne pouvez pas désactiver votre propre compte.");
    }
  }

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new UtilisateurRuleError("Rôle inconnu.");

  const perdLaGestion =
    !input.isActive || !((role.permissions as string[] | null) ?? []).includes("users.manage");
  if (perdLaGestion) {
    await garderUnAdministrateur(
      userId,
      "C'est le dernier compte actif capable de gérer les utilisateurs : le modifier fermerait cet écran à tout le monde.",
    );
  }

  const apres = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      roleId: role.id,
      isActive: input.isActive,
      // Réactiver un compte lève aussi le verrou : sinon l'agent réactivé se
      // heurte à un « compte verrouillé » sans comprendre pourquoi.
      ...(input.isActive && !avant.isActive ? { failedAttempts: 0, lockedUntil: null } : {}),
      // Désactiver ferme les sessions ouvertes **pour de bon** : sans changer
      // de version, réactiver le compte plus tard les rouvrirait (§18).
      ...(!input.isActive && avant.isActive ? { sessionVersion: { increment: 1 } } : {}),
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "user.updated",
    entity: "User",
    entityId: userId,
    before: { name: avant.name, role: avant.role.name, isActive: avant.isActive },
    after: { name: apres.name, role: role.name, isActive: apres.isActive },
  });

  return apres;
}

export async function reinitialiserMotDePasse(
  userId: string,
  motDePasse: string,
  acteur: Acteur,
): Promise<void> {
  const utilisateur = await prisma.user.findUnique({ where: { id: userId } });
  if (!utilisateur) throw new UtilisateurRuleError("Compte introuvable.");

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await argon2.hash(motDePasse, { type: argon2.argon2id }),
      // Un mot de passe neuf sur un compte verrouillé doit fonctionner tout de
      // suite : le verrou porte sur les essais ratés, qui n'ont plus lieu d'être.
      failedAttempts: 0,
      lockedUntil: null,
      // Remplacer un mot de passe, c'est souvent répondre à une fuite : les
      // sessions ouvertes avec l'ancien sont fermées (§18).
      sessionVersion: { increment: 1 },
    },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "user.password_reset",
    entity: "User",
    entityId: userId,
    after: { email: utilisateur.email },
  });
}

/**
 * Détache le second facteur : le compte devra le réenrôler à la connexion
 * suivante. C'est la réponse au téléphone perdu ou remplacé, seul cas où un
 * compte soumis au 2FA redevient joignable sans intervention en base.
 */
export async function reinitialiserDeuxFacteurs(userId: string, acteur: Acteur): Promise<void> {
  const utilisateur = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { name: true } } },
  });
  if (!utilisateur) throw new UtilisateurRuleError("Compte introuvable.");
  if (!utilisateur.totpEnabled) {
    throw new UtilisateurRuleError("Ce compte n'a pas de second facteur activé.");
  }

  await prisma.user.update({
    where: { id: userId },
    // Téléphone perdu, peut-être volé : les sessions ouvertes sont fermées (§18).
    data: { totpSecret: null, totpEnabled: false, sessionVersion: { increment: 1 } },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "user.totp_reset",
    entity: "User",
    entityId: userId,
    before: { totpEnabled: true },
    after: { totpEnabled: false, role: utilisateur.role.name },
  });
}

// --- Rôles ------------------------------------------------------------------

/**
 * Remplace les permissions d'un rôle (§8.2).
 *
 * Deux garde-fous, et un avertissement qui n'en est pas un :
 *
 * 1. Retirer `users.manage` au dernier rôle actif qui le porte fermerait cet
 *    écran à tout le monde — refusé, comme pour la désactivation d'un compte.
 * 2. On ne modifie pas son **propre** rôle : les droits sont relus à chaque
 *    requête (§18), et se retirer un droit fermerait l'écran en cours de route,
 *    sans retour possible.
 *
 * Pour les autres comptes, le changement s'applique à leur requête suivante.
 */
export async function enregistrerPermissionsRole(
  roleId: string,
  permissions: readonly string[],
  acteur: Acteur,
) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new UtilisateurRuleError("Rôle inconnu.");

  const moi = await prisma.user.findUnique({
    where: { id: acteur.userId },
    select: { roleId: true },
  });
  if (moi?.roleId === roleId) {
    throw new UtilisateurRuleError(
      "Vous ne pouvez pas modifier les droits de votre propre rôle : le changement s'appliquerait aussitôt et pourrait vous fermer cet écran. Passez par un autre compte administrateur.",
    );
  }

  // Seules les permissions du catalogue sont acceptées : une valeur forgée
  // deviendrait une chaîne inerte que `can()` ne reconnaîtrait jamais, et le
  // rôle paraîtrait porter un droit qu'il n'a pas.
  const connues = permissions.filter((permission) =>
    (PERMISSIONS as readonly string[]).includes(permission),
  );

  const perdLaGestion =
    ((role.permissions as string[] | null) ?? []).includes("users.manage") &&
    !connues.includes("users.manage");

  if (perdLaGestion) {
    const rolesRestants = await prisma.role.findMany({ select: { id: true, permissions: true } });
    const autresGestionnaires = rolesRestants
      .filter((autre) => autre.id !== roleId)
      .filter((autre) => ((autre.permissions as string[] | null) ?? []).includes("users.manage"))
      .map((autre) => autre.id);

    const encoreUn =
      autresGestionnaires.length > 0 &&
      (await prisma.user.count({
        where: { roleId: { in: autresGestionnaires }, isActive: true },
      })) > 0;

    if (!encoreUn) {
      throw new UtilisateurRuleError(
        "C'est le dernier rôle actif capable de gérer les utilisateurs : lui retirer ce droit fermerait cet écran à tout le monde.",
      );
    }
  }

  const apres = await prisma.role.update({
    where: { id: roleId },
    data: { permissions: connues },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "role.permissions_updated",
    entity: "Role",
    entityId: roleId,
    before: { permissions: role.permissions },
    after: { permissions: connues },
  });

  return apres;
}

/** Lève le verrouillage des 15 minutes sans attendre son expiration. */
export async function deverrouiller(userId: string, acteur: Acteur): Promise<void> {
  const utilisateur = await prisma.user.findUnique({ where: { id: userId } });
  if (!utilisateur) throw new UtilisateurRuleError("Compte introuvable.");

  await prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "user.unlocked",
    entity: "User",
    entityId: userId,
    before: { lockedUntil: utilisateur.lockedUntil, failedAttempts: utilisateur.failedAttempts },
  });
}
