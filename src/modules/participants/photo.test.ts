import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { createParticipant } from "./service";
import { detectImageType, saveParticipantPhoto, removeParticipantPhoto } from "./photo";

/** En-têtes réels des trois formats acceptés, complétés de remplissage. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.alloc(4, 0),
  Buffer.from("WEBP"),
  Buffer.alloc(64, 1),
]);

describe("détection du type d'image", () => {
  it("reconnaît les formats acceptés à leurs octets", () => {
    expect(detectImageType(JPEG)?.type).toBe("image/jpeg");
    expect(detectImageType(PNG)?.type).toBe("image/png");
    expect(detectImageType(WEBP)?.type).toBe("image/webp");
  });

  it("refuse un fichier qui se prétend image sans en être une", () => {
    // Cas concret : un script déposé avec l'extension et le type MIME d'une
    // image. Se fier au `Content-Type` déclaré l'aurait laissé passer.
    const script = Buffer.from('<?php system($_GET["c"]); ?>' + " ".repeat(64));
    expect(detectImageType(script)).toBeNull();
  });

  it("refuse un fichier trop court pour porter une signature", () => {
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it("refuse un format d'image non prévu (GIF)", () => {
    const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(64, 1)]);
    expect(detectImageType(gif)).toBeNull();
  });
});

describe("enregistrement de la photo (brief §5.3)", () => {
  const emails: string[] = [];
  let editionId = "";
  let editionCode = "";
  let categoryId = "";

  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    editionCode = edition.code;
    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "SPONSOR" },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    // Les fichiers ne partent pas avec le participant : la base cascade, pas le
    // disque. Sans ce ménage, le dossier de stockage enfle à chaque exécution.
    const restants = await prisma.participant.findMany({
      where: { email: { in: emails }, photoPath: { not: null } },
      select: { photoPath: true },
    });
    for (const { photoPath } of restants) {
      await fileStorage.delete(photoPath!).catch(() => undefined);
    }

    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  async function participantDeTest() {
    const email = `photo-${crypto.randomUUID()}@example.test`;
    emails.push(email);
    return createParticipant({
      editionId,
      editionCode,
      source: "ONSITE",
      actor: { type: "SYSTEM" },
      input: {
        firstName: "Awa",
        lastName: "Diagne",
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
  }

  it("enregistre le fichier et renseigne le participant", async () => {
    const participant = await participantDeTest();
    const resultat = await saveParticipantPhoto(
      participant.id,
      new File([new Uint8Array(JPEG)], "photo.jpg", { type: "image/jpeg" }),
    );

    expect(resultat.status).toBe("OK");
    if (resultat.status !== "OK") return;
    expect(resultat.path).toMatch(new RegExp(`^photos/${participant.publicId}-[0-9a-f]{12}\.jpg$`));

    const enregistre = await prisma.participant.findUniqueOrThrow({
      where: { id: participant.id },
    });
    expect(enregistre.photoPath).toBe(resultat.path);
    expect((await fileStorage.get(resultat.path)).subarray(0, 3)).toEqual(JPEG.subarray(0, 3));
  });

  it("refuse un fichier qui n'est pas une image, quel que soit son type déclaré", async () => {
    const participant = await participantDeTest();
    const resultat = await saveParticipantPhoto(
      participant.id,
      new File(
        [new Uint8Array(Buffer.from("#!/bin/sh\nrm -rf /\n" + " ".repeat(64)))],
        "photo.jpg",
        {
          type: "image/jpeg",
        },
      ),
    );

    expect(resultat.status).toBe("UNSUPPORTED_TYPE");
    const inchange = await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(inchange.photoPath).toBeNull();
  });

  it("refuse un fichier au-delà de la limite", async () => {
    const participant = await participantDeTest();
    const trop = Buffer.concat([JPEG, Buffer.alloc(3 * 1024 * 1024, 0)]);
    const resultat = await saveParticipantPhoto(
      participant.id,
      new File([new Uint8Array(trop)], "photo.jpg", { type: "image/jpeg" }),
    );

    expect(resultat.status).toBe("TOO_LARGE");
  });

  it("remplace la photo sans laisser l'ancien fichier derrière", async () => {
    const participant = await participantDeTest();
    const premier = await saveParticipantPhoto(
      participant.id,
      new File([new Uint8Array(JPEG)], "photo.jpg", { type: "image/jpeg" }),
    );
    const second = await saveParticipantPhoto(
      participant.id,
      new File([new Uint8Array(PNG)], "photo.png", { type: "image/png" }),
    );

    expect(premier.status).toBe("OK");
    expect(second.status).toBe("OK");
    if (premier.status !== "OK" || second.status !== "OK") return;

    // Chemin différent : un remplacement ne doit pas être masqué par un cache.
    expect(second.path).not.toBe(premier.path);
    await expect(fileStorage.get(premier.path)).rejects.toBeTruthy();
    expect((await fileStorage.get(second.path)).length).toBeGreaterThan(0);
  });

  it("retire la photo et son fichier", async () => {
    const participant = await participantDeTest();
    const enregistre = await saveParticipantPhoto(
      participant.id,
      new File([new Uint8Array(JPEG)], "photo.jpg", { type: "image/jpeg" }),
    );
    if (enregistre.status !== "OK") throw new Error("photo non enregistrée");

    await removeParticipantPhoto(participant.id);

    const apres = await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(apres.photoPath).toBeNull();
    await expect(fileStorage.get(enregistre.path)).rejects.toBeTruthy();
  });
});
