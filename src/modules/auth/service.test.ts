import argon2 from "argon2";
import { generate } from "otplib";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { generateTotpSecret } from "@/lib/totp";
import { authenticateUser, enableTotp } from "./service";

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

  async function createUser(overrides: Partial<{ totpEnabled: boolean; totpSecret: string }> = {}) {
    const role = await prisma.role.findFirstOrThrow({ where: { name: "LECTEUR" } });
    const user = await prisma.user.create({
      data: {
        email: `test-auth-${crypto.randomUUID()}@example.test`,
        name: "Test User",
        passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
        roleId: role.id,
        isActive: true,
        ...overrides,
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

  it("requires a TOTP code when 2FA is enabled, and validates it", async () => {
    const secret = generateTotpSecret();
    const user = await createUser({ totpEnabled: true, totpSecret: secret });

    const withoutCode = await authenticateUser(user.email, PASSWORD);
    expect(withoutCode.status).toBe("TOTP_REQUIRED");

    const withWrongCode = await authenticateUser(user.email, PASSWORD, "000000");
    expect(withWrongCode.status).toBe("TOTP_INVALID");

    // Le code TOTP change toutes les 30 secondes. `authenticateUser` vérifie un
    // hachage argon2, qui peut prendre plusieurs secondes sous charge : sans
    // marge, le code expirait entre sa génération et sa vérification et le test
    // échouait au hasard. On attend donc le début d'un pas.
    const secondesRestantes = 30 - (Math.floor(Date.now() / 1000) % 30);
    if (secondesRestantes < 15) {
      await new Promise((resolve) => setTimeout(resolve, (secondesRestantes + 1) * 1000));
    }

    const validCode = await generate({ secret });
    const withValidCode = await authenticateUser(user.email, PASSWORD, validCode);
    expect(withValidCode.status).toBe("OK");
  });

  describe("enrôlement du second facteur (PLAN.md §18)", () => {
    it("active le 2FA et ferme les autres sessions du compte", async () => {
      const user = await createUser();
      const secret = generateTotpSecret();

      const resultat = await enableTotp(user.id, secret, await generate({ secret }));

      expect(resultat).toBe("OK");
      const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(apres.totpEnabled).toBe(true);
      expect(apres.totpSecret).toBe(secret);
      expect(apres.sessionVersion).toBe(user.sessionVersion + 1);
    });

    it("refuse de remplacer un second facteur déjà actif", async () => {
      // Le défaut : depuis une session ouverte, même volée, la page
      // d'enrôlement remplaçait le second facteur du compte par un autre.
      const secretEnPlace = generateTotpSecret();
      const user = await createUser({ totpEnabled: true, totpSecret: secretEnPlace });
      const secretPirate = generateTotpSecret();

      const resultat = await enableTotp(
        user.id,
        secretPirate,
        await generate({ secret: secretPirate }),
      );

      expect(resultat).toBe("DEJA_ACTIVE");
      const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(apres.totpSecret).toBe(secretEnPlace);
      expect(apres.sessionVersion).toBe(user.sessionVersion);
    });

    it("refuse un code faux ou un secret qui n'est pas du base32", async () => {
      const user = await createUser();
      const secret = generateTotpSecret();

      expect(await enableTotp(user.id, secret, "000000")).toBe("CODE_INVALIDE");
      expect(await enableTotp(user.id, "pas un secret", "123456")).toBe("CODE_INVALIDE");
      const apres = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(apres.totpEnabled).toBe(false);
    });
  });
});
