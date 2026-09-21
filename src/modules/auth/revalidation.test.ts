import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { revaliderJeton } from "./revalidation";
import { droitsDuCompte } from "./service";

/**
 * Revalidation des sessions du BackOffice (PLAN.md §18).
 *
 * Le défaut d'origine, mesuré sur l'application : un compte désactivé gardait
 * sa session ouverte. Ces tests portent sur la fonction qu'Auth.js appelle à
 * chaque lecture de session ; `e2e/securite.spec.ts` vérifie le même effet de
 * bout en bout.
 */

const identifiants: string[] = [];

async function creerCompte(roleName = "LECTEUR") {
  const role = await prisma.role.findFirstOrThrow({ where: { name: roleName } });
  const compte = await prisma.user.create({
    data: {
      email: `test-revalidation-${crypto.randomUUID()}@example.test`,
      name: "Revalidation",
      // Jamais vérifié ici : aucun test ne se connecte.
      passwordHash: "non-utilise",
      roleId: role.id,
    },
    include: { role: true },
  });
  identifiants.push(compte.id);
  return compte;
}

/** Jeton tel qu'Auth.js le construit à la connexion. */
function jetonDe(compte: Awaited<ReturnType<typeof creerCompte>>) {
  return { sub: compte.id, email: compte.email, name: compte.name, ...droitsDuCompte(compte) };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: identifiants } } });
  await prisma.$disconnect();
});

describe("revalidation des sessions du BackOffice", () => {
  it("garde une session dont le compte est actif et la version inchangée", async () => {
    const compte = await creerCompte();
    const jeton = jetonDe(compte);

    const revalide = await revaliderJeton(jeton);

    expect(revalide).not.toBeNull();
    expect(revalide?.sub).toBe(compte.id);
    expect(revalide?.permissions).toEqual(jeton.permissions);
  });

  it("ferme la session d'un compte désactivé", async () => {
    const compte = await creerCompte();
    const jeton = jetonDe(compte);
    await prisma.user.update({ where: { id: compte.id }, data: { isActive: false } });

    expect(await revaliderJeton(jeton)).toBeNull();
  });

  it("ferme la session quand la version de session a changé", async () => {
    const compte = await creerCompte();
    const jeton = jetonDe(compte);
    await prisma.user.update({
      where: { id: compte.id },
      data: { sessionVersion: { increment: 1 } },
    });

    expect(await revaliderJeton(jeton)).toBeNull();
  });

  it("refuse un jeton émis avant la version de session", async () => {
    const compte = await creerCompte();
    const { sessionVersion: _retire, ...ancien } = jetonDe(compte);

    expect(await revaliderJeton(ancien)).toBeNull();
  });

  it("refuse un jeton sans compte ou d'un compte inexistant", async () => {
    const compte = await creerCompte();
    const jeton = jetonDe(compte);

    expect(await revaliderJeton({ ...jeton, sub: undefined })).toBeNull();
    expect(await revaliderJeton({ ...jeton, sub: "compte-inexistant" })).toBeNull();
  });

  it("applique un changement de rôle dès la lecture suivante", async () => {
    const compte = await creerCompte("LECTEUR");
    const jeton = jetonDe(compte);
    const agent = await prisma.role.findFirstOrThrow({ where: { name: "AGENT_ACCUEIL" } });
    await prisma.user.update({ where: { id: compte.id }, data: { roleId: agent.id } });

    const revalide = await revaliderJeton(jeton);

    expect(revalide?.roleName).toBe("AGENT_ACCUEIL");
    expect(revalide?.permissions).toEqual(agent.permissions);
    expect(revalide?.permissions).toContain("scan.use");
  });
});
