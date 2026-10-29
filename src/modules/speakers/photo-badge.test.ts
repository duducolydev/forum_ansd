import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { jobQueue } from "@/lib/queue";
import { fileStorage } from "@/lib/storage";
import { createParticipantFromSpeaker, saveSpeakerPhoto } from "./service";

/** En-tête JPEG réel, complété de remplissage. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

/**
 * Photo de la fiche intervenant et badge du participant lié (29 octobre 2026).
 */
describe("photo d'intervenant et badge", () => {
  const suffixe = randomUUID().replace(/-/g, "").slice(0, 8).toLowerCase();
  const speakerIds: string[] = [];
  const participantIds: string[] = [];

  afterAll(async () => {
    const photos = await prisma.speaker.findMany({
      where: { id: { in: speakerIds }, photoPath: { not: null } },
      select: { photoPath: true },
    });
    await Promise.all(photos.map(({ photoPath }) => fileStorage.delete(photoPath!)));
    await prisma.speaker.deleteMany({ where: { id: { in: speakerIds } } });
    await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
    await prisma.$disconnect();
  });

  it("crée le participant au format commun, nom en capitales, et refait son badge à la photo", async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    const categorie = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId: edition.id, code: "PARTICIPANT_NATIONAL" },
    });
    const speaker = await prisma.speaker.create({
      data: {
        editionId: edition.id,
        firstName: "Mady",
        lastName: "Biaye",
        email: `biaye-${suffixe}@example.test`,
      },
    });
    speakerIds.push(speaker.id);

    const participantId = await createParticipantFromSpeaker(
      edition.id,
      edition.code,
      speaker.id,
      categorie.id,
      { type: "SYSTEM" },
    );
    participantIds.push(participantId);
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { id: participantId },
    });
    expect(participant.publicId).toMatch(/^FID26-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    expect(participant.lastName).toBe("BIAYE");

    await prisma.badge.create({
      data: { participantId, qrToken: `intervenant-${suffixe}`, generatedAt: new Date() },
    });
    const enqueue = vi.spyOn(jobQueue, "enqueue").mockResolvedValue(undefined);
    try {
      await saveSpeakerPhoto(
        speaker.id,
        new File([new Uint8Array(JPEG)], "photo.jpg", { type: "image/jpeg" }),
      );
      expect(enqueue).toHaveBeenCalledWith(
        "badge.generate",
        { participantId, silencieux: true },
        expect.anything(),
      );
    } finally {
      enqueue.mockRestore();
    }
  });
});
