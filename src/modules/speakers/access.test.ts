import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  adresseIntervenant,
  consumeMagicLink,
  consumeSpeakerLink,
  requestSpeakerLink,
} from "@/modules/auth/magic-link";

const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();

let editionId = "";
let categoryId = "";
let speakerId = "";
let participantId = "";
const emails: string[] = [];

/**
 * Le jeton en clair ne vit que dans le message envoyé : la base n'en garde que
 * l'empreinte, ce qui est précisément sa valeur. Les tests posent donc le lien
 * directement, avec le même hachage que le module — c'est la **consommation**
 * qu'ils éprouvent, et c'est là que se joue le cloisonnement entre les deux
 * types de destinataires.
 */
function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function poserLienIntervenant(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.magicLink.create({
    data: {
      speakerId,
      tokenHash: hash(token),
      code6: "000000",
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  return token;
}

async function poserLienParticipant(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.magicLink.create({
    data: {
      participantId,
      tokenHash: hash(token),
      code6: "000000",
      expiresAt: new Date(Date.now() + 600_000),
    },
  });
  return token;
}

describe("accès des intervenants (brief §5.8, contradiction C12)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    categoryId = (
      await prisma.participantCategory.findFirstOrThrow({
        where: { editionId, code: "PARTICIPANT_NATIONAL" },
      })
    ).id;

    const email = `speaker-${randomUUID()}@example.test`;
    emails.push(email);
    speakerId = (
      await prisma.speaker.create({
        data: {
          editionId,
          email,
          firstName: "Test",
          lastName: `Intervenant${SUFFIXE}`,
        },
      })
    ).id;

    const emailParticipant = `part-${randomUUID()}@example.test`;
    emails.push(emailParticipant);
    participantId = (
      await prisma.participant.create({
        data: {
          editionId,
          publicId: `SPK-${SUFFIXE}`,
          firstName: "Test",
          lastName: "Participant",
          email: emailParticipant,
          country: "Sénégal",
          categoryId,
          status: "CONFIRMED",
          source: "ONSITE",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.magicLink.deleteMany({ where: { OR: [{ speakerId }, { participantId }] } });
    await prisma.speaker.deleteMany({ where: { id: speakerId } });
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  }, 30_000);

  describe("adresse de contact", () => {
    it("préfère l'adresse propre de l'intervenant", () => {
      expect(
        adresseIntervenant({ email: "a@example.test", participant: { email: "b@example.test" } }),
      ).toBe("a@example.test");
    });

    it("retombe sur celle du participant lié", () => {
      expect(adresseIntervenant({ email: null, participant: { email: "b@example.test" } })).toBe(
        "b@example.test",
      );
    });

    it("rend null quand l'intervenant est injoignable", () => {
      // C'est le cas que le BackOffice doit signaler : un panéliste sans
      // adresse ne recevra jamais son lien.
      expect(adresseIntervenant({ email: null, participant: null })).toBeNull();
    });
  });

  describe("lien d'accès", () => {
    it("répond SENT pour une adresse inconnue, sans rien révéler", async () => {
      const resultat = await requestSpeakerLink(editionId, "inconnu@example.test", "");
      expect(resultat.status).toBe("SENT");
      // Aucun lien créé : la réponse est la même, l'effet ne l'est pas.
      expect(await prisma.magicLink.count({ where: { speakerId } })).toBe(0);
    });

    it("enregistre un lien pour un intervenant connu", async () => {
      const speaker = await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId } });
      expect((await requestSpeakerLink(editionId, speaker.email!, "")).status).toBe("SENT");
      expect(await prisma.magicLink.count({ where: { speakerId } })).toBeGreaterThan(0);
    });

    it("ouvre l'espace une fois, et une seule", async () => {
      const jeton = await poserLienIntervenant();
      expect(await consumeSpeakerLink(jeton)).toEqual({ status: "OK", speakerId });
      expect((await consumeSpeakerLink(jeton)).status).toBe("INVALID");
    });

    it("refuse un lien expiré", async () => {
      const token = randomBytes(32).toString("base64url");
      await prisma.magicLink.create({
        data: {
          speakerId,
          tokenHash: hash(token),
          code6: "000000",
          expiresAt: new Date(Date.now() - 1000),
        },
      });
      expect((await consumeSpeakerLink(token)).status).toBe("INVALID");
    });

    /**
     * Le contrôle qui compte : les deux types de liens partagent une table.
     * Sans cloisonnement, un lien d'intervenant ouvrirait un espace participant
     * — sur un identifiant nul, donc au mieux une erreur.
     */
    it("n'ouvre pas l'espace participant avec un lien d'intervenant", async () => {
      const jeton = await poserLienIntervenant();
      expect((await consumeMagicLink(jeton)).status).toBe("INVALID");
      // Et le refus n'a pas consommé le jeton : il sert encore à ce pour quoi
      // il a été émis.
      expect((await consumeSpeakerLink(jeton)).status).toBe("OK");
    });

    it("n'ouvre pas l'espace intervenant avec un lien de participant", async () => {
      const jeton = await poserLienParticipant();
      expect((await consumeSpeakerLink(jeton)).status).toBe("INVALID");
      expect((await consumeMagicLink(jeton)).status).toBe("OK");
    });
  });
});
