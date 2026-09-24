import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLE_LABELS } from "@/lib/permissions";
import { UtilisateurRuleError, type Acteur } from "./service";

/**
 * Création, renommage et suppression des rôles (§30).
 *
 * L'ajustement des **droits** d'un rôle existait déjà (`enregistrerPermissionsRole`) ;
 * ce qui manquait, c'était de pouvoir en inventer un. D'où la distinction qui
 * structure tout ce fichier :
 *
 * - les rôles **du brief** (`DEFAULT_ROLE_PERMISSIONS`) sont nommés dans le
 *   code : `exigeSecondFacteur` compare leur nom, `ROLE_LABELS` les traduit, le
 *   seed les recrée. Les renommer ou les supprimer casserait ces liens en
 *   silence — un `SUPER_ADMIN` renommé cesserait d'exiger un second facteur
 *   sans qu'aucune erreur ne le signale. Ils sont donc intouchables, sauf leurs
 *   droits ;
 * - les rôles **créés ici** ne sont nommés nulle part dans le code. Leur
 *   libellé se change et ils se suppriment, tant que personne ne les porte.
 */

/** Rôle défini par le brief, donc référencé par son nom dans le code. */
export function estRoleIntegre(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(DEFAULT_ROLE_PERMISSIONS, name);
}

/** Libellé affiché : celui du registre pour les rôles du brief, sinon celui de la base. */
export function libelleRole(role: { name: string; label?: string | null }): string {
  return ROLE_LABELS[role.name] ?? role.label ?? role.name;
}

/**
 * Nom technique : capitales, chiffres et tirets bas.
 *
 * C'est la forme des rôles existants, et celle que le code compare. Accepter
 * les minuscules ou les accents aurait produit des noms qui se ressemblent sans
 * être égaux — « Logistique » et « LOGISTIQUE » sont deux rôles distincts pour
 * la base, et un seul pour l'œil.
 */
export function normaliserNomRole(brut: string): string {
  return brut
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function permissionsConnues(permissions: readonly string[]): string[] {
  return permissions.filter((permission) =>
    (PERMISSIONS as readonly string[]).includes(permission),
  );
}

export async function creerRole(
  input: { name: string; label: string; permissions: readonly string[] },
  acteur: Acteur,
) {
  const name = normaliserNomRole(input.name);
  if (name.length < 3) {
    throw new UtilisateurRuleError(
      "Le nom technique doit comporter au moins trois lettres ou chiffres.",
    );
  }
  if (estRoleIntegre(name)) {
    throw new UtilisateurRuleError(
      `« ${name} » est un rôle du brief : il existe déjà et ne se recrée pas.`,
    );
  }

  const label = input.label.trim();
  if (!label) throw new UtilisateurRuleError("Le libellé est requis.");

  try {
    const role = await prisma.role.create({
      data: { name, label, permissions: permissionsConnues(input.permissions) },
    });

    await audit.log({
      actorType: "USER",
      actorUserId: acteur.userId,
      action: "role.create",
      entity: "Role",
      entityId: role.id,
      after: { name: role.name, label: role.label, permissions: role.permissions },
    });

    return role;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new UtilisateurRuleError(`Un rôle nommé « ${name} » existe déjà.`);
    }
    throw error;
  }
}

/**
 * Renommage : le **libellé** seulement.
 *
 * Le nom technique reste figé après la création, y compris pour un rôle
 * inventé ici : il est déjà inscrit sur les comptes qui le portent et dans le
 * journal d'audit, et le changer rendrait ces traces illisibles pour un gain
 * purement cosmétique — le libellé suffit à cela.
 */
export async function renommerRole(roleId: string, label: string, acteur: Acteur) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new UtilisateurRuleError("Rôle inconnu.");

  if (estRoleIntegre(role.name)) {
    throw new UtilisateurRuleError(
      `« ${libelleRole(role)} » est un rôle du brief : son libellé est fixé dans le code, pour rester identique d'une édition à l'autre.`,
    );
  }

  const propre = label.trim();
  if (!propre) throw new UtilisateurRuleError("Le libellé est requis.");

  const apres = await prisma.role.update({ where: { id: roleId }, data: { label: propre } });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "role.rename",
    entity: "Role",
    entityId: roleId,
    before: { label: role.label },
    after: { label: apres.label },
  });

  return apres;
}

export async function supprimerRole(roleId: string, acteur: Acteur): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new UtilisateurRuleError("Rôle inconnu.");

  if (estRoleIntegre(role.name)) {
    throw new UtilisateurRuleError(
      `« ${libelleRole(role)} » est un rôle du brief : le supprimer casserait les règles qui le nomment dans le code.`,
    );
  }

  if (role._count.users > 0) {
    throw new UtilisateurRuleError(
      `${role._count.users} compte(s) portent encore ce rôle. Attribuez-leur un autre rôle avant de le supprimer.`,
    );
  }

  /*
   * Garde-fou de dernier recours : un rôle sans titulaire ne peut pas être le
   * dernier à porter `users.manage`, puisqu'il faudrait un compte actif pour
   * l'exercer. La vérification reste écrite parce qu'elle ne coûte rien et que
   * la règle, elle, doit survivre à un changement de la précédente.
   */
  const moi = await prisma.user.findUnique({
    where: { id: acteur.userId },
    select: { roleId: true },
  });
  if (moi?.roleId === roleId) {
    throw new UtilisateurRuleError("Vous ne pouvez pas supprimer votre propre rôle.");
  }

  await prisma.role.delete({ where: { id: roleId } });

  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "role.delete",
    entity: "Role",
    entityId: roleId,
    before: { name: role.name, label: role.label, permissions: role.permissions },
  });
}
