import { createHash } from "node:crypto";
import argon2 from "argon2";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { authenticateByChallenge, authenticateUser } from "./service";

/*
 * argon2 est **volontairement** coûteux : c'est ce qui protège les mots de
 * passe. Chaque test de ce fichier en enchaîne plusieurs, et quand la suite
 * tourne à plusieurs fichiers de front sur une machine chargée, le délai par
 * défaut est dépassé sans qu'aucun défaut applicatif soit en cause. Le seuil
 * est relevé ici seulement, plutôt que d'aveugler toute la suite.
 */
vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

const PASSWORD = "Test-Password-123!";

describe("authenticateUser (règles métier — brief §7)", () => {
  const userIds: string[] = [];

  async function createUser(roleName = "LECTEUR") {
    const role = await prisma.role.findFirstOrThrow({ where: { name: roleName } });
    const user = await prisma.user.create({
      data: {
        email: `test-auth-${crypto.randomUUID()}@example.test`,
        name: "Test User",
        passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
        roleId: role.id,
        isActive: true,
      },
    });
    userIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("returns OK with the role's permissions on valid credentials", async () => {
    const user = await createUser();
    const result = await authenticateUser(user.email, PASSWORD);
    expect(result.status).toBe("OK");
    if (result.status === "OK") {
      expect(result.user.roleName).toBe("LECTEUR");
      expect(result.user.permissions).toContain("participants.read");
    }
  });

  it("rejects an invalid password without revealing whether the account exists", async () => {
    const user = await createUser();
    const known = await authenticateUser(user.email, "wrong-password");
    const unknown = await authenticateUser("no-such-user@example.test", "wrong-password");
    expect(known.status).toBe("INVALID_CREDENTIALS");
    expect(unknown.status).toBe("INVALID_CREDENTIALS");
  });

  it("locks the account after 5 failed attempts, for 15 minutes (brief §7)", async () => {
    const user = await createUser();

    for (let i = 0; i < 5; i++) {
      const result = await authenticateUser(user.email, "wrong-password");
      expect(result.status).toBe("INVALID_CREDENTIALS");
    }

    // Le 6e essai, même avec le bon mot de passe, doit être bloqué par le verrou.
    const lockedResult = await authenticateUser(user.email, PASSWORD);
    expect(lockedResult.status).toBe("LOCKED");
    if (lockedResult.status === "LOCKED") {
      expect(lockedResult.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it("resets the failed-attempt counter on a successful login", async () => {
    const user = await createUser();
    await authenticateUser(user.email, "wrong-password");
    await authenticateUser(user.email, "wrong-password");
    const ok = await authenticateUser(user.email, PASSWORD);
    expect(ok.status).toBe("OK");

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(refreshed.failedAttempts).toBe(0);
  });

  /*
   * Second facteur par e-mail (PLAN.md §23), en remplacement du TOTP.
   *
   * Les comptes soumis au second facteur sont ceux des rôles d'administration :
   * le mot de passe seul n'ouvre plus rien, il déclenche l'envoi d'un code.
   */
  describe("second facteur par e-mail", () => {
    /** Code en attente, tel que le message l'aurait porté. */
    async function codeEnAttente(userId: string): Promise<string> {
      const defi = await prisma.adminLoginChallenge.findFirstOrThrow({
        where: { userId, usedAt: null },
        orderBy: { createdAt: "desc" },
      });
      return defi.code6;
    }

    it("n'ouvre pas la session sur le seul mot de passe : un code part par e-mail", async () => {
      const user = await createUser("ADMIN_FORUM");

      const premier = await authenticateUser(user.email, PASSWORD);

      expect(premier.status).toBe("CODE_SENT");
      const defi = await prisma.adminLoginChallenge.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(defi.code6).toMatch(/^\d{6}$/);
      // Le jeton du lien n'est pas stocké en clair.
      expect(defi.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      const minutes = (defi.expiresAt.getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(8);
      expect(minutes).toBeLessThanOrEqual(10);
    });

    it("ouvre la session avec le code reçu, et ce code ne resert pas", async () => {
      const user = await createUser("ADMIN_FORUM");
      await authenticateUser(user.email, PASSWORD);
      const code = await codeEnAttente(user.id);

      const connexion = await authenticateUser(user.email, PASSWORD, code);
      expect(connexion.status).toBe("OK");

      const rejoue = await authenticateUser(user.email, PASSWORD, code);
      expect(rejoue.status).toBe("CODE_INVALID");
    });

    it("annule le code précédent quand un nouveau est demandé", async () => {
      const user = await createUser("ADMIN_FORUM");
      await authenticateUser(user.email, PASSWORD);
      const premier = await codeEnAttente(user.id);

      await authenticateUser(user.email, PASSWORD);
      const second = await codeEnAttente(user.id);
      expect(second).not.toBe(premier);

      // Sans cette annulation, chaque demande ajouterait une chance de deviner.
      expect((await authenticateUser(user.email, PASSWORD, premier)).status).toBe("CODE_INVALID");
      expect((await authenticateUser(user.email, PASSWORD, second)).status).toBe("OK");
    });

    it("refuse un code expiré", async () => {
      const user = await createUser("ADMIN_FORUM");
      await authenticateUser(user.email, PASSWORD);
      const code = await codeEnAttente(user.id);
      await prisma.adminLoginChallenge.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      expect((await authenticateUser(user.email, PASSWORD, code)).status).toBe("CODE_INVALID");
    });

    it("compte les codes faux comme des échecs, jusqu'au verrouillage", async () => {
      const user = await createUser("ADMIN_FORUM");
      await authenticateUser(user.email, PASSWORD);

      for (let essai = 0; essai < 5; essai++) {
        expect((await authenticateUser(user.email, PASSWORD, "000000")).status).toBe(
          "CODE_INVALID",
        );
      }

      // Le compte est verrouillé comme après cinq mots de passe faux.
      expect((await authenticateUser(user.email, PASSWORD)).status).toBe("LOCKED");
    });

    it("ouvre la session par le lien reçu, une seule fois", async () => {
      const user = await createUser("ADMIN_FORUM");
      const jeton = "jeton-de-test-" + crypto.randomUUID();
      await prisma.adminLoginChallenge.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(jeton).digest("hex"),
          code6: "123456",
          expiresAt: new Date(Date.now() + 10 * 60_000),
        },
      });

      expect((await authenticateByChallenge(jeton)).status).toBe("OK");
      expect((await authenticateByChallenge(jeton)).status).toBe("CODE_INVALID");
      expect((await authenticateByChallenge("jeton-inexistant")).status).toBe("CODE_INVALID");
    });

    it("laisse entrer directement les rôles sans second facteur", async () => {
      // Les agents d'accueil scannent des badges : leur imposer un aller-retour
      // par la boîte mail bloquerait l'accueil le jour J.
      const agent = await createUser("AGENT_ACCUEIL");
      expect((await authenticateUser(agent.email, PASSWORD)).status).toBe("OK");
    });
  });
});
