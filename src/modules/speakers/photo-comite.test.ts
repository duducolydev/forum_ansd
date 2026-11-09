import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { deposerPhotoParLeComite, retirerPhotoParLeComite, SpeakerRuleError } from "./service";

/** Photo déposée par le comité, pour ceux qui ne le font pas eux-mêmes. */
describe("photo déposée par le comité", () => {
  const suffixe = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  // En-tête JPEG : le type se lit dans les octets, pas dans le nom du fichier.
  const jpeg = () =>
    new File(
      [Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 1)])],
      "p.jpg",
      {
        type: "image/jpeg",
      },
    );

  let editionId = "";
  let categorieId = "";
  let acteur = { userId: "" };
  const participantIds: string[] = [];
  const speakerIds: string[] = [];

  async function creerParticipant(rang: string) {
    const participant = await prisma.participant.create({
      data: {
        editionId,
        publicId: `COMITE-${suffixe}-${rang}`,
        firstName: "Awa",
        lastName: `COMITE${suffixe}`,
        email: `comite-${rang}-${suffixe.toLowerCase()}@x.test`,
        country: "Sénégal",
        categoryId: categorieId,
      },
    });
    participantIds.push(participant.id);
    return participant.id;
  }

  async function creerIntervenant(participantId: string | null = null) {
    const speaker = await prisma.speaker.create({
      data: { editionId, firstName: "Awa", lastName: `COMITE${suffixe}`, participantId },
    });
    speakerIds.push(speaker.id);
    return speaker.id;
  }

  const photos = async (participantId: string | null, speakerId: string | null) => ({
    participant: participantId
      ? (await prisma.participant.findUniqueOrThrow({ where: { id: participantId } })).photoPath
      : null,
    speaker: speakerId
      ? (await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId } })).photoPath
      : null,
  });

  beforeAll(async () => {
    editionId = (await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } })).id;
    categorieId = (
      await prisma.participantCategory.findFirstOrThrow({
        where: { editionId, code: "PARTICIPANT_NATIONAL" },
      })
    ).id;
    acteur = { userId: (await prisma.user.findFirstOrThrow({ select: { id: true } })).id };
  });

  afterAll(async () => {
    for (const speakerId of speakerIds) {
      await retirerPhotoParLeComite({ speakerId }, acteur).catch(() => undefined);
    }
    for (const participantId of participantIds) {
      await retirerPhotoParLeComite({ participantId }, acteur).catch(() => undefined);
    }
    await prisma.speaker.deleteMany({ where: { id: { in: speakerIds } } });
    await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
    await prisma.$disconnect();
  });

  it("dépose sur le participant seul, et trace le membre du comité", async () => {
    const participantId = await creerParticipant("seul");

    await deposerPhotoParLeComite({ participantId }, jpeg(), acteur);

    const { participant } = await photos(participantId, null);
    expect(participant).toMatch(/^photos\/.+\.jpg$/);
    expect(await fileStorage.get(participant!)).toBeInstanceOf(Buffer);
    const trace = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: participantId, action: "participant.photo_updated" },
    });
    expect(trace).toMatchObject({ actorType: "USER", actorUserId: acteur.userId });
  });

  it("dépose sur l'intervenant sans participant", async () => {
    const speakerId = await creerIntervenant();

    await deposerPhotoParLeComite({ speakerId }, jpeg(), acteur);

    expect((await photos(null, speakerId)).speaker).toMatch(/^speakers\/.+\.jpg$/);
  });

  it.each(["participant", "intervenant"] as const)(
    "depuis la fiche %s d'une personne qui a les deux, remplit les deux",
    async (depuis) => {
      const participantId = await creerParticipant(depuis);
      const speakerId = await creerIntervenant(participantId);

      await deposerPhotoParLeComite(
        depuis === "participant" ? { participantId } : { speakerId },
        jpeg(),
        acteur,
      );

      const apres = await photos(participantId, speakerId);
      expect(apres.participant).toMatch(/^photos\//);
      expect(apres.speaker).toMatch(/^speakers\//);
    },
  );

  it("retire la photo des deux fiches et efface les fichiers", async () => {
    const participantId = await creerParticipant("retrait");
    const speakerId = await creerIntervenant(participantId);
    await deposerPhotoParLeComite({ speakerId }, jpeg(), acteur);
    const { participant, speaker } = await photos(participantId, speakerId);

    await retirerPhotoParLeComite({ participantId }, acteur);

    expect(await photos(participantId, speakerId)).toEqual({ participant: null, speaker: null });
    await expect(fileStorage.get(participant!)).rejects.toBeDefined();
    await expect(fileStorage.get(speaker!)).rejects.toBeDefined();
  });

  it("refuse un fichier qui n'est pas une image, sans rien enregistrer", async () => {
    const participantId = await creerParticipant("refus");
    const speakerId = await creerIntervenant(participantId);
    const faux = new File([Buffer.from("<html>pas une image</html>")], "p.jpg", {
      type: "image/jpeg",
    });

    await expect(deposerPhotoParLeComite({ speakerId }, faux, acteur)).rejects.toBeInstanceOf(
      SpeakerRuleError,
    );

    expect(await photos(participantId, speakerId)).toEqual({ participant: null, speaker: null });
  });

  it("refuse une fiche inconnue", async () => {
    await expect(
      deposerPhotoParLeComite({ participantId: "inconnu" }, jpeg(), acteur),
    ).rejects.toBeInstanceOf(SpeakerRuleError);
  });
});
