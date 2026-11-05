import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { designerPourSession, SpeakerRuleError } from "./service";

/**
 * Désignation d'un participant comme intervenant (panéliste, modérateur…),
 * depuis sa fiche participant.
 */
describe("désignation d'un participant comme intervenant", () => {
  const suffixe = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const acteur = { type: "SYSTEM" as const };
  let editionId = "";
  let categorieId = "";
  let sessionA = "";
  let sessionB = "";
  const participantIds: string[] = [];

  async function creerParticipant(prenom: string, email: string) {
    const participant = await prisma.participant.create({
      data: {
        editionId,
        publicId: `DESI-${suffixe}-${participantIds.length}`,
        civility: "Dr",
        firstName: prenom,
        lastName: `Ndiaye${suffixe}`,
        email,
        country: "Sénégal",
        organization: "ANSD",
        jobTitle: "Statisticienne",
        bio: "Spécialiste des enquêtes ménages.",
        categoryId: categorieId,
      },
    });
    participantIds.push(participant.id);
    return participant.id;
  }

  async function creerSession(lettre: string) {
    return (
      await prisma.session.create({
        data: {
          editionId,
          slug: `designation-${lettre}-${suffixe.toLowerCase()}`,
          type: "PANEL",
          titleFr: `Panel ${lettre} ${suffixe}`,
          titleEn: `Panel ${lettre}`,
          day: new Date("2026-11-24T00:00:00.000Z"),
          startTime: new Date("2026-11-24T09:00:00.000Z"),
          endTime: new Date("2026-11-24T10:00:00.000Z"),
        },
      })
    ).id;
  }

  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    categorieId = (
      await prisma.participantCategory.findFirstOrThrow({
        where: { editionId, code: "PARTICIPANT_NATIONAL" },
      })
    ).id;
    sessionA = await creerSession("a");
    sessionB = await creerSession("b");
  });

  afterAll(async () => {
    await prisma.speaker.deleteMany({ where: { participantId: { in: participantIds } } });
    await prisma.speaker.deleteMany({ where: { lastName: { contains: suffixe } } });
    await prisma.session.deleteMany({ where: { id: { in: [sessionA, sessionB] } } });
    await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
    await prisma.$disconnect();
  });

  it("crée la fiche intervenant depuis l'inscription, en brouillon, et la rattache", async () => {
    const participantId = await creerParticipant("Awa", `awa-${suffixe.toLowerCase()}@x.test`);

    const { speakerId, origine } = await designerPourSession(
      participantId,
      sessionA,
      "MODERATOR",
      acteur,
    );

    expect(origine).toBe("creee");
    const fiche = await prisma.speaker.findUniqueOrThrow({
      where: { id: speakerId },
      include: { sessions: true },
    });
    expect(fiche).toMatchObject({
      participantId,
      civility: "Dr",
      firstName: "Awa",
      organization: "ANSD",
      bioFr: "Spécialiste des enquêtes ménages.",
      // L'adresse reste celle du participant, seule à tenir à jour.
      email: null,
      isPublished: false,
    });
    expect(fiche.sessions).toEqual([
      expect.objectContaining({ sessionId: sessionA, role: "MODERATOR" }),
    ]);

    // Une seconde session reprend la même fiche.
    const ensuite = await designerPourSession(participantId, sessionB, "PANELIST", acteur);
    expect(ensuite).toMatchObject({ speakerId, origine: "existante" });
    expect(await prisma.speaker.count({ where: { participantId } })).toBe(1);
  });

  it("reprend la fiche intervenant saisie à part avec la même adresse", async () => {
    const email = `binta-${suffixe.toLowerCase()}@x.test`;
    const saisie = await prisma.speaker.create({
      data: { editionId, firstName: "Binta", lastName: `Ndiaye${suffixe}`, email },
    });
    const participantId = await creerParticipant("Binta", email);

    const { speakerId, origine } = await designerPourSession(
      participantId,
      sessionA,
      "PANELIST",
      acteur,
    );

    expect(origine).toBe("rapprochee");
    expect(speakerId).toBe(saisie.id);
    expect(
      (await prisma.speaker.findUniqueOrThrow({ where: { id: saisie.id } })).participantId,
    ).toBe(participantId);
  });

  it("ne crée rien quand la session ou le rôle est refusé", async () => {
    const participantId = await creerParticipant(
      "Coumba",
      `coumba-${suffixe.toLowerCase()}@x.test`,
    );

    await expect(
      designerPourSession(participantId, "session-inexistante", "PANELIST", acteur),
    ).rejects.toBeInstanceOf(SpeakerRuleError);
    await expect(
      designerPourSession(participantId, sessionA, "RAPPORTEUR", acteur),
    ).rejects.toBeInstanceOf(SpeakerRuleError);

    expect(await prisma.speaker.count({ where: { participantId } })).toBe(0);
  });
});
