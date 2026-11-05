import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { mySpaceInputSchema, updateMyInfo } from "@/modules/participants/my-space-service";
import { designerIntervenant, speakerInputSchema, updateSelf, updateSpeaker } from "./service";

/** Biographie commune au participant et à sa fiche intervenant. */
describe("biographie commune participant / intervenant", () => {
  const suffixe = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const acteur = { type: "SYSTEM" as const };
  let editionId = "";
  let categorieId = "";
  const participantIds: string[] = [];

  async function creerPaire(bio: string | null, bioFr: string | null) {
    const participant = await prisma.participant.create({
      data: {
        editionId,
        publicId: `BIO-${suffixe}-${participantIds.length}`,
        firstName: "Awa",
        lastName: `Sow${suffixe}`,
        email: `bio-${participantIds.length}-${suffixe.toLowerCase()}@x.test`,
        country: "Sénégal",
        categoryId: categorieId,
        bio,
      },
    });
    participantIds.push(participant.id);
    const speaker = await prisma.speaker.create({
      data: {
        editionId,
        participantId: participant.id,
        firstName: "Awa",
        lastName: `Sow${suffixe}`,
        bioFr,
      },
    });
    return { participantId: participant.id, speakerId: speaker.id };
  }

  const lire = async (participantId: string, speakerId: string) => ({
    bio: (await prisma.participant.findUniqueOrThrow({ where: { id: participantId } })).bio,
    bioFr: (await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId } })).bioFr,
  });

  /** Ce que « Mon espace » envoie pour une fiche, biographie comprise. */
  const saisieMonEspace = (bio: string, phone = "") =>
    mySpaceInputSchema.parse({
      firstName: "Awa",
      lastName: `Sow${suffixe}`,
      country: "Sénégal",
      participationDays: ["2026-11-23"],
      phone,
      bio,
    });

  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    categorieId = (
      await prisma.participantCategory.findFirstOrThrow({
        where: { editionId, code: "PARTICIPANT_NATIONAL" },
      })
    ).id;
  });

  // « Mon espace » ferme à J-3 : la date est figée avant, pour que le test ne
  // dépende pas du jour où il tourne. Seul `Date` est simulé.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T10:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await prisma.speaker.deleteMany({ where: { lastName: { contains: suffixe } } });
    await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
    await prisma.$disconnect();
  });

  it("recopie sur la fiche intervenant la biographie modifiée dans « Mon espace »", async () => {
    const { participantId, speakerId } = await creerPaire("Ancienne.", "Ancienne.");

    await updateMyInfo(participantId, saisieMonEspace("Statisticienne à l'ANSD."));

    expect(await lire(participantId, speakerId)).toEqual({
      bio: "Statisticienne à l'ANSD.",
      bioFr: "Statisticienne à l'ANSD.",
    });
  });

  it("n'écrase pas la biographie du programme quand seule une autre donnée change", async () => {
    const { participantId, speakerId } = await creerPaire(
      "Courte.",
      "Longue, rédigée par le comité.",
    );

    await updateMyInfo(participantId, saisieMonEspace("Courte.", "+221 77 123 45 67"));

    expect((await lire(participantId, speakerId)).bioFr).toBe("Longue, rédigée par le comité.");
  });

  it("recopie sur le participant la biographie modifiée par le comité ou par l'intervenant", async () => {
    const { participantId, speakerId } = await creerPaire(null, null);

    await updateSpeaker(
      speakerId,
      speakerInputSchema.parse({
        firstName: "Awa",
        lastName: `Sow${suffixe}`,
        bioFr: "Par le comité.",
      }),
      acteur,
    );
    expect(await lire(participantId, speakerId)).toEqual({
      bio: "Par le comité.",
      bioFr: "Par le comité.",
    });

    await updateSelf(speakerId, { bioFr: "Par l'intervenant." });
    expect((await lire(participantId, speakerId)).bio).toBe("Par l'intervenant.");
  });

  it("complète le côté vide au rapprochement d'une fiche saisie à part", async () => {
    const participant = await prisma.participant.create({
      data: {
        editionId,
        publicId: `BIO-${suffixe}-R`,
        firstName: "Binta",
        lastName: `Sow${suffixe}`,
        email: `binta-${suffixe.toLowerCase()}@x.test`,
        country: "Sénégal",
        categoryId: categorieId,
      },
    });
    participantIds.push(participant.id);
    const fiche = await prisma.speaker.create({
      data: {
        editionId,
        firstName: "Binta",
        lastName: `Sow${suffixe}`,
        email: participant.email,
        bioFr: "Biographie du programme.",
      },
    });

    const { origine } = await designerIntervenant(participant.id, acteur);

    expect(origine).toBe("rapprochee");
    expect(await lire(participant.id, fiche.id)).toEqual({
      bio: "Biographie du programme.",
      bioFr: "Biographie du programme.",
    });
  });
});
