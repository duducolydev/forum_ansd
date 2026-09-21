import argon2 from "argon2";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  creerUtilisateur,
  deverrouiller,
  modifierUtilisateur,
  reinitialiserMotDePasse,
  UtilisateurRuleError,
} from "./service";
import { creationUtilisateurSchema } from "./schema";

/*
 * argon2 est volontairement coûteux, et chaque création de compte en paie le
 * prix : même relèvement de délai que dans `modules/auth/service.test.ts`.
 */
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

const MOT_DE_PASSE = "Mot-De-Passe-Test-1!";

const identifiants: string[] = [];

async function creerCompteTest(roleName = "LECTEUR", actif = true) {
  const role = await prisma.role.findFirstOrThrow({ where: { name: roleName } });
  const utilisateur = await prisma.user.create({
    data: {
      email: `test-users-${crypto.randomUUID()}@example.test`,
      name: "Compte de test",
      passwordHash: await argon2.hash(MOT_DE_PASSE, { type: argon2.argon2id }),
      roleId: role.id,
      isActive: actif,
    },
  });
  identifiants.push(utilisateur.id);
  return utilisateur;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: identifiants } } });
  await prisma.user.deleteMany({ where: { id: { in: identifiants } } });
  await prisma.$disconnect();
});

describe("politique de mot de passe (brief §7)", () => {
  it("refuse en deçà de douze caractères", () => {
    const base = { email: "a@example.test", name: "Test", roleId: "x" };
    expect(creationUtilisateurSchema.safeParse({ ...base, password: "court1!" }).success).toBe(
      false,
    );
    expect(creationUtilisateurSchema.safeParse({ ...base, password: "douze-caract" }).success).toBe(
      true,
    );
  });
});

describe("creerUtilisateur", () => {
  it("refuse une adresse déjà prise", async () => {
    const existant = await creerCompteTest();
    const role = await prisma.role.findFirstOrThrow({ where: { name: "LECTEUR" } });

    await expect(
      creerUtilisateur(
        { email: existant.email, name: "Doublon", roleId: role.id, password: MOT_DE_PASSE },
        { userId: existant.id },
      ),
    ).rejects.toBeInstanceOf(UtilisateurRuleError);
  });

  it("journalise la création sans jamais écrire le mot de passe", async () => {
    const acteur = await creerCompteTest();
    const role = await prisma.role.findFirstOrThrow({ where: { name: "LECTEUR" } });

    const cree = await creerUtilisateur(
      {
        email: `test-users-${crypto.randomUUID()}@example.test`,
        name: "Nouveau",
        roleId: role.id,
        password: MOT_DE_PASSE,
      },
      { userId: acteur.id },
    );
    identifiants.push(cree.id);

    const trace = await prisma.auditLog.findFirstOrThrow({
      where: { entity: "User", entityId: cree.id, action: "user.created" },
    });
    const serialise = JSON.stringify(trace.after);
    expect(serialise).toContain("Nouveau");
    expect(serialise).not.toContain(MOT_DE_PASSE);
    // Ni le mot de passe ni son empreinte : le journal est consultable en ligne.
    expect(serialise).not.toContain("$argon2");
  });
});

describe("garde-fous de modification", () => {
  it("interdit de changer son propre rôle", async () => {
    const moi = await creerCompteTest();
    const autreRole = await prisma.role.findFirstOrThrow({ where: { name: "SUPER_ADMIN" } });

    await expect(
      modifierUtilisateur(
        moi.id,
        { name: moi.name, roleId: autreRole.id, isActive: true },
        { userId: moi.id },
      ),
    ).rejects.toThrow(/votre propre rôle/);
  });

  it("interdit de désactiver son propre compte", async () => {
    const moi = await creerCompteTest();

    await expect(
      modifierUtilisateur(
        moi.id,
        { name: moi.name, roleId: moi.roleId, isActive: false },
        { userId: moi.id },
      ),
    ).rejects.toThrow(/votre propre compte/);
  });

  it("laisse passer la modification d'un autre compte", async () => {
    const acteur = await creerCompteTest();
    const cible = await creerCompteTest();

    const apres = await modifierUtilisateur(
      cible.id,
      { name: "Nom corrigé", roleId: cible.roleId, isActive: false },
      { userId: acteur.id },
    );

    expect(apres.name).toBe("Nom corrigé");
    expect(apres.isActive).toBe(false);
  });

  it("lève le verrou en réactivant un compte", async () => {
    const acteur = await creerCompteTest();
    const cible = await creerCompteTest("LECTEUR", false);
    await prisma.user.update({
      where: { id: cible.id },
      data: { failedAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) },
    });

    const apres = await modifierUtilisateur(
      cible.id,
      { name: cible.name, roleId: cible.roleId, isActive: true },
      { userId: acteur.id },
    );

    // Sans cela, le compte rouvert reste inutilisable quinze minutes de plus.
    expect(apres.lockedUntil).toBeNull();
    expect(apres.failedAttempts).toBe(0);
  });

  it("refuse de retirer le dernier compte capable de gérer les utilisateurs", async () => {
    const rolesAdmin = await prisma.role.findMany();
    const idsAdmin = rolesAdmin
      .filter((role) => ((role.permissions as string[] | null) ?? []).includes("users.manage"))
      .map((role) => role.id);

    const gestionnaires = await prisma.user.findMany({
      where: { roleId: { in: idsAdmin }, isActive: true },
      select: { id: true },
    });

    const seul = await creerCompteTest("SUPER_ADMIN");
    const acteur = await creerCompteTest();
    const lecteur = await prisma.role.findFirstOrThrow({ where: { name: "LECTEUR" } });

    /*
     * Le garde-fou ne se déclenche que s'il ne reste **aucun** autre
     * gestionnaire actif. On met donc de côté ceux de la base le temps de
     * l'assertion, et on les rétablit dans le `finally` — la désactivation est
     * réversible et ne touche ni les rôles ni les mots de passe.
     */
    try {
      await prisma.user.updateMany({
        where: { id: { in: gestionnaires.map((compte) => compte.id) } },
        data: { isActive: false },
      });

      await expect(
        modifierUtilisateur(
          seul.id,
          { name: seul.name, roleId: lecteur.id, isActive: true },
          { userId: acteur.id },
        ),
      ).rejects.toThrow(/dernier compte actif/);

      await expect(
        modifierUtilisateur(
          seul.id,
          { name: seul.name, roleId: seul.roleId, isActive: false },
          { userId: acteur.id },
        ),
      ).rejects.toThrow(/dernier compte actif/);
    } finally {
      await prisma.user.updateMany({
        where: { id: { in: gestionnaires.map((compte) => compte.id) } },
        data: { isActive: true },
      });
    }
  });
});

describe("fermeture des sessions ouvertes (PLAN.md §18)", () => {
  async function version(userId: string): Promise<number> {
    const compte = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return compte.sessionVersion;
  }

  it("désactiver ferme les sessions, et réactiver ne les rouvre pas", async () => {
    const acteur = await creerCompteTest();
    const cible = await creerCompteTest();
    const avant = await version(cible.id);

    await modifierUtilisateur(
      cible.id,
      { name: cible.name, roleId: cible.roleId, isActive: false },
      { userId: acteur.id },
    );
    expect(await version(cible.id)).toBe(avant + 1);

    await modifierUtilisateur(
      cible.id,
      { name: cible.name, roleId: cible.roleId, isActive: true },
      { userId: acteur.id },
    );
    // Toujours différente de celle des jetons émis avant la désactivation.
    expect(await version(cible.id)).toBe(avant + 1);
  });

  it("remplacer le mot de passe ferme les sessions", async () => {
    const acteur = await creerCompteTest();
    const cible = await creerCompteTest();
    const avant = await version(cible.id);

    await reinitialiserMotDePasse(cible.id, "Nouveau-Mot-De-Passe-9!", { userId: acteur.id });

    expect(await version(cible.id)).toBe(avant + 1);
  });

  it("corriger un nom ou un rôle ne ferme pas les sessions : les droits sont relus", async () => {
    const acteur = await creerCompteTest();
    const cible = await creerCompteTest();
    const agent = await prisma.role.findFirstOrThrow({ where: { name: "AGENT_ACCUEIL" } });
    const avant = await version(cible.id);

    await modifierUtilisateur(
      cible.id,
      { name: "Nom corrigé", roleId: agent.id, isActive: true },
      { userId: acteur.id },
    );

    expect(await version(cible.id)).toBe(avant);
  });
});

describe("dépannage des comptes", () => {
  it("remplace le mot de passe et lève le verrouillage", async () => {
    const acteur = await creerCompteTest();
    const cible = await creerCompteTest();
    await prisma.user.update({
      where: { id: cible.id },
      data: { failedAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) },
    });

    const nouveau = "Nouveau-Mot-De-Passe-9!";
    await reinitialiserMotDePasse(cible.id, nouveau, { userId: acteur.id });

    const apres = await prisma.user.findUniqueOrThrow({ where: { id: cible.id } });
    expect(await argon2.verify(apres.passwordHash, nouveau)).toBe(true);
    expect(apres.lockedUntil).toBeNull();
  });

  it("déverrouille sans changer le mot de passe", async () => {
    const acteur = await creerCompteTest();
    const cible = await creerCompteTest();
    await prisma.user.update({
      where: { id: cible.id },
      data: { failedAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) },
    });

    await deverrouiller(cible.id, { userId: acteur.id });

    const apres = await prisma.user.findUniqueOrThrow({ where: { id: cible.id } });
    expect(apres.lockedUntil).toBeNull();
    expect(apres.failedAttempts).toBe(0);
    expect(await argon2.verify(apres.passwordHash, MOT_DE_PASSE)).toBe(true);
  });
});
