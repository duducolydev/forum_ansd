import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createParticipant } from "@/modules/participants/service";
import { consumeCode, consumeMagicLink, requestMagicLink } from "./magic-link";

const emails: string[] = [];
let editionId = "";
let editionCode = "";
let categoryId = "";

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function makeParticipant(): Promise<{ id: string; email: string }> {
  const email = `magic-${crypto.randomUUID()}@example.test`;
  emails.push(email);
  const participant = await createParticipant({
    editionId,
    editionCode,
    source: "ONSITE",
    actor: { type: "SYSTEM" },
    input: {
      firstName: "Fatou",
      lastName: "Sow",
      email,
      country: "Sénégal",
      locale: "fr",
      categoryId,
      attendsOpening: false,
      attendsInaugural: false,
      attendsAwards: false,
      needsAccommodation: false,
      needsTransport: false,
    },
  });
  return { id: participant.id, email };
}

describe("lien magique (brief §5.3)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    editionCode = edition.code;
    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it("répond SENT sans créer de lien pour un e-mail inconnu (pas d'énumération)", async () => {
    const unknown = `inconnu-${crypto.randomUUID()}@example.test`;
    const before = await prisma.magicLink.count();

    const result = await requestMagicLink(editionId, unknown, "127.0.0.1");

    expect(result.status).toBe("SENT");
    expect(await prisma.magicLink.count()).toBe(before);
  });

  it("crée un lien de 30 minutes avec un code à 6 chiffres pour un participant connu", async () => {
    const participant = await makeParticipant();

    const result = await requestMagicLink(editionId, participant.email.toUpperCase(), "127.0.0.1");
    expect(result.status).toBe("SENT");

    const link = await prisma.magicLink.findFirstOrThrow({
      where: { participantId: participant.id },
    });
    expect(link.code6).toMatch(/^\d{6}$/);
    const minutes = (link.expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(25);
    expect(minutes).toBeLessThanOrEqual(30);
  });

  it("consomme le jeton une seule fois", async () => {
    const participant = await makeParticipant();
    const token = randomBytes(32).toString("base64url");
    await prisma.magicLink.create({
      data: {
        participantId: participant.id,
        tokenHash: hash(token),
        code6: "123456",
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    const first = await consumeMagicLink(token);
    expect(first).toEqual({ status: "OK", participantId: participant.id });

    const second = await consumeMagicLink(token);
    expect(second.status).toBe("INVALID");
  });

  it("refuse un jeton expiré", async () => {
    const participant = await makeParticipant();
    const token = randomBytes(32).toString("base64url");
    await prisma.magicLink.create({
      data: {
        participantId: participant.id,
        tokenHash: hash(token),
        code6: "123456",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    expect((await consumeMagicLink(token)).status).toBe("INVALID");
  });

  it("accepte le code de secours puis le marque utilisé", async () => {
    const participant = await makeParticipant();
    await prisma.magicLink.create({
      data: {
        participantId: participant.id,
        tokenHash: hash(randomBytes(32).toString("base64url")),
        code6: "654321",
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    expect((await consumeCode(editionId, participant.email, "000000")).status).toBe("INVALID");

    const ok = await consumeCode(editionId, participant.email, "654321");
    expect(ok).toEqual({ status: "OK", participantId: participant.id });

    const link = await prisma.magicLink.findFirstOrThrow({
      where: { participantId: participant.id },
    });
    expect(link.usedAt).not.toBeNull();

    expect((await consumeCode(editionId, participant.email, "654321")).status).toBe("INVALID");
  });

  it("limite les demandes à 3 par minute et par e-mail", async () => {
    const participant = await makeParticipant();
    const statuses: string[] = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await requestMagicLink(editionId, participant.email, "127.0.0.1")).status);
    }
    expect(statuses).toEqual(["SENT", "SENT", "SENT", "RATE_LIMITED"]);
  });

  /*
   * Force brute du code à 6 chiffres (PLAN.md §18). Chaque demande laissait les
   * codes précédents valides : ~90 codes simultanés, près d'une chance sur deux
   * par jour de deviner l'un d'eux.
   */
  describe("code à 6 chiffres : résistance à la force brute", () => {
    async function creerLien(participantId: string, code6: string, ilYaMs = 0) {
      return prisma.magicLink.create({
        data: {
          participantId,
          tokenHash: hash(randomBytes(32).toString("base64url")),
          code6,
          expiresAt: new Date(Date.now() + 30 * 60_000),
          createdAt: new Date(Date.now() - ilYaMs),
        },
      });
    }

    it("une nouvelle demande annule les liens précédents", async () => {
      const participant = await makeParticipant();

      await requestMagicLink(editionId, participant.email, "127.0.0.1");
      await requestMagicLink(editionId, participant.email, "127.0.0.1");

      const liens = await prisma.magicLink.findMany({
        where: { participantId: participant.id },
        orderBy: { createdAt: "asc" },
      });
      expect(liens).toHaveLength(2);
      expect(liens[0]!.usedAt).not.toBeNull();
      expect(liens[1]!.usedAt).toBeNull();
    });

    it("ne compare que le dernier lien valide", async () => {
      const participant = await makeParticipant();
      // Deux liens valides, comme en laissait l'ancienne règle.
      await creerLien(participant.id, "111111", 60_000);
      await creerLien(participant.id, "222222");

      expect((await consumeCode(editionId, participant.email, "111111")).status).toBe("INVALID");
      expect(await consumeCode(editionId, participant.email, "222222")).toEqual({
        status: "OK",
        participantId: participant.id,
      });
    });

    it("cinq codes erronés annulent le lien", async () => {
      const participant = await makeParticipant();
      const lien = await creerLien(participant.id, "654321");

      for (const code of ["000001", "000002", "000003", "000004", "000005"]) {
        expect((await consumeCode(editionId, participant.email, code)).status).toBe("INVALID");
      }

      const apres = await prisma.magicLink.findUniqueOrThrow({ where: { id: lien.id } });
      expect(apres.failedAttempts).toBe(5);
      expect(apres.usedAt).not.toBeNull();
    });

    it("quatre erreurs laissent encore passer le bon code", async () => {
      const participant = await makeParticipant();
      await creerLien(participant.id, "654321");

      for (const code of ["000001", "000002", "000003", "000004"]) {
        await consumeCode(editionId, participant.email, code);
      }

      expect((await consumeCode(editionId, participant.email, "654321")).status).toBe("OK");
    });

    it("plafonne les demandes à 10 par jour et par adresse", async () => {
      const participant = await makeParticipant();
      // Le compteur journalier est rempli directement : atteindre dix demandes
      // par l'API demanderait d'attendre la fenêtre par minute.
      for (let i = 0; i < 10; i++) {
        await rateLimit(`magic-link:${participant.email}:jour`, 10, 24 * 60 * 60);
      }

      expect((await requestMagicLink(editionId, participant.email, "127.0.0.1")).status).toBe(
        "RATE_LIMITED",
      );
    });

    it("un lien ne se consomme qu'une fois, même par des requêtes simultanées", async () => {
      const participant = await makeParticipant();
      const token = randomBytes(32).toString("base64url");
      await prisma.magicLink.create({
        data: {
          participantId: participant.id,
          tokenHash: hash(token),
          code6: "123456",
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });

      const resultats = await Promise.all(Array.from({ length: 5 }, () => consumeMagicLink(token)));

      expect(resultats.filter((resultat) => resultat.status === "OK")).toHaveLength(1);
    });

    it("refuse le code d'un participant supprimé", async () => {
      const participant = await makeParticipant();
      await creerLien(participant.id, "654321");
      await prisma.participant.update({
        where: { id: participant.id },
        data: { deletedAt: new Date() },
      });

      expect((await consumeCode(editionId, participant.email, "654321")).status).toBe("INVALID");
    });
  });
});
