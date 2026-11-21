import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createParticipant } from "@/modules/participants/service";
import { consumeCode, consumeMagicLink, creerCodeSecours, requestMagicLink } from "./magic-link";

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
      attendsClosing: false,
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

  /*
   * Vingt-quatre heures depuis le 21 novembre 2026, et non plus trente minutes :
   * la file étale les envois et reporte jusqu'à six heures ce que la boîte
   * refuse faute de quota, si bien qu'un lien de trente minutes arrivait
   * périmé.
   */
  it("crée un lien de 24 heures avec un code à 6 chiffres pour un participant connu", async () => {
    const participant = await makeParticipant();

    const result = await requestMagicLink(editionId, participant.email.toUpperCase(), "127.0.0.1");
    expect(result.status).toBe("SENT");

    const link = await prisma.magicLink.findFirstOrThrow({
      where: { participantId: participant.id },
    });
    expect(link.code6).toMatch(/^\d{6}$/);
    const heures = (link.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(heures).toBeGreaterThan(23);
    expect(heures).toBeLessThanOrEqual(24);
  });

  /*
   * Le jeton était à usage unique. Les passerelles de messagerie d'entreprise
   * ouvrent les liens d'un message avant leur destinataire : le lien était
   * consommé par l'antivirus, et la personne lisait « lien expiré » sur un lien
   * qu'elle n'avait jamais ouvert. Un rechargement ou un second onglet faisaient
   * de même.
   */
  it("laisse le jeton valable jusqu'à son expiration", async () => {
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

    const attendu = { status: "OK", participantId: participant.id };
    expect(await consumeMagicLink(token)).toEqual(attendu);
    expect(await consumeMagicLink(token)).toEqual(attendu);
    expect(await consumeMagicLink(token)).toEqual(attendu);
  });

  /*
   * Le courriel propose un lien **et** un code, et les deux vivent sur la même
   * ligne : saisir le code rendait inopérant le lien du même message.
   */
  it("laisse le lien du même courriel valable après usage de son code", async () => {
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

    expect((await consumeCode(editionId, participant.email, "123456")).status).toBe("OK");
    expect(await consumeMagicLink(token)).toEqual({
      status: "OK",
      participantId: participant.id,
    });
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

  it("refuse un mauvais code, accepte le bon, et le garde valable", async () => {
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

    // Le code n'est pas consommé : il rouvre l'espace depuis un autre appareil
    // tant qu'il n'est pas expiré ni annulé (21 novembre 2026).
    const link = await prisma.magicLink.findFirstOrThrow({
      where: { participantId: participant.id },
    });
    expect(link.usedAt).toBeNull();

    expect((await consumeCode(editionId, participant.email, "654321")).status).toBe("OK");
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

    it("une nouvelle demande laisse valable le code de secours de l'e-mail de confirmation", async () => {
      const participant = await makeParticipant();
      const secours = await creerCodeSecours(participant.id, 7);

      await requestMagicLink(editionId, participant.email, "127.0.0.1");

      expect(await consumeCode(editionId, participant.email, secours)).toEqual({
        status: "OK",
        participantId: participant.id,
      });
    });

    /*
     * Le tri reposait sur l'échéance : étaient annulés les liens expirant avant
     * le nouveau. À trente minutes de validité, un code de secours de sept
     * jours n'entrait jamais dans la fourchette. À vingt-quatre heures, un code
     * de secours entamé y serait tombé — et la demande d'un lien aurait fait
     * échouer le code du courriel de confirmation, exactement le défaut que la
     * règle du 3 novembre voulait éviter.
     */
    it("laisse valable un code de secours à qui il reste moins d'une journée", async () => {
      const participant = await makeParticipant();
      const jour = 24 * 3_600_000;
      await prisma.magicLink.create({
        data: {
          participantId: participant.id,
          tokenHash: hash(randomBytes(32).toString("base64url")),
          code6: "778899",
          // Émis il y a six jours et demi pour sept jours : il reste douze heures.
          createdAt: new Date(Date.now() - 6.5 * jour),
          expiresAt: new Date(Date.now() + 0.5 * jour),
        },
      });

      await requestMagicLink(editionId, participant.email, "127.0.0.1");

      expect(await consumeCode(editionId, participant.email, "778899")).toEqual({
        status: "OK",
        participantId: participant.id,
      });
    });

    it("accepte aussi le code du lien demandé quand un code de secours existe", async () => {
      const participant = await makeParticipant();
      await creerCodeSecours(participant.id, 7);
      await creerLien(participant.id, "222222");

      expect((await consumeCode(editionId, participant.email, "222222")).status).toBe("OK");
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

    it("ouvre l'espace sur chacune de cinq requêtes simultanées", async () => {
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

      // Ce test gardait l'inverse — une seule réussite — du temps où le jeton
      // était à usage unique. C'est la course qui n'existe plus, pas le besoin
      // d'y résister : un lien réutilisable n'a rien à départager.
      expect(resultats.filter((resultat) => resultat.status === "OK")).toHaveLength(5);
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

  /**
   * Dossier non validé (16 novembre 2026).
   *
   * Le défaut signalé : la personne recevait un lien et un code, puis lisait
   * « lien invalide ou expiré » — un message qui ne disait rien de la vraie
   * raison et l'envoyait écrire au comité.
   */
  describe("inscription en attente de validation", () => {
    async function enAttente() {
      const participant = await makeParticipant();
      await prisma.participant.update({
        where: { id: participant.id },
        data: { status: "REGISTERED", confirmedAt: null },
      });
      return participant;
    }

    it("n'envoie ni lien ni code, et dit pourquoi", async () => {
      const participant = await enAttente();

      expect(await requestMagicLink(editionId, participant.email, "127.0.0.1")).toEqual({
        status: "ACCES_REFUSE",
        motif: "EN_ATTENTE_VALIDATION",
      });
      // Rien n'a été créé : c'est le lien envoyé pour rien qui faisait croire
      // le compte ouvert.
      expect(await prisma.magicLink.count({ where: { participantId: participant.id } })).toBe(0);
    });

    it("répond « en attente » plutôt que « code invalide » à un code pourtant juste", async () => {
      const participant = await makeParticipant();
      await prisma.magicLink.create({
        data: {
          participantId: participant.id,
          tokenHash: hash(randomBytes(32).toString("base64url")),
          code6: "112233",
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });
      await prisma.participant.update({
        where: { id: participant.id },
        data: { status: "REGISTERED", confirmedAt: null },
      });

      expect(await consumeCode(editionId, participant.email, "112233")).toEqual({
        status: "ACCES_REFUSE",
        motif: "EN_ATTENTE_VALIDATION",
      });
    });

    it("refuse un lien émis avant la mise en attente, sans le consommer", async () => {
      const participant = await makeParticipant();
      const token = randomBytes(32).toString("base64url");
      await prisma.magicLink.create({
        data: {
          participantId: participant.id,
          tokenHash: hash(token),
          code6: "445566",
          expiresAt: new Date(Date.now() + 30 * 60_000),
        },
      });
      await prisma.participant.update({
        where: { id: participant.id },
        data: { status: "CANCELLED" },
      });

      expect(await consumeMagicLink(token)).toEqual({
        status: "ACCES_REFUSE",
        motif: "INSCRIPTION_CLOSE",
      });
      // Le jeton n'a servi à rien : le brûler ajouterait un « lien expiré » au
      // refus si le dossier était rouvert dans la demi-heure.
      const lien = await prisma.magicLink.findUniqueOrThrow({ where: { tokenHash: hash(token) } });
      expect(lien.usedAt).toBeNull();
    });
  });
});
