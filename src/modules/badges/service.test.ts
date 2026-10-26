import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { closeBrowser, resolveBrowserPath } from "@/lib/pdf";
import { fileStorage } from "@/lib/storage";
import { createParticipant, confirmParticipant } from "@/modules/participants/service";
import {
  generateBadge,
  getCurrentBadge,
  recordPrint,
  reissueBadge,
  revokeBadge,
  verifyBadgeToken,
} from "./service";
import { buildBadgeToken } from "./token";
import { compterAncienGabarit } from "./bulk";
import { FORMAT_BADGE } from "./format";

const ACTOR = { type: "SYSTEM" as const };
const emails: string[] = [];
const publicIds: string[] = [];
let editionId = "";
let editionCode = "";
let categoryId = "";

async function makeConfirmedParticipant() {
  const email = `badge-${crypto.randomUUID()}@example.test`;
  emails.push(email);
  const participant = await createParticipant({
    editionId,
    editionCode,
    source: "ONSITE",
    actor: ACTOR,
    input: {
      firstName: "Aminata",
      lastName: "Sow",
      email,
      country: "Sénégal",
      locale: "fr",
      categoryId,
      organization: "ANSD",
      jobTitle: "Directrice des statistiques démographiques",
      attendsOpening: false,
      attendsInaugural: false,
      attendsClosing: false,
      attendsAwards: false,
      needsAccommodation: false,
      needsTransport: false,
    },
  });
  publicIds.push(participant.publicId);
  if (participant.status !== "CONFIRMED") {
    await confirmParticipant(participant.id, ACTOR);
  }
  return prisma.participant.findUniqueOrThrow({ where: { id: participant.id } });
}

describe.skipIf(!resolveBrowserPath())("badges (brief §5.4)", () => {
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
    const root = process.env.STORAGE_LOCAL_PATH ?? "./storage";
    for (const publicId of publicIds) {
      await rm(join(root, "badges", publicId), { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
    await closeBrowser();
    await prisma.$disconnect();
  }, 30_000);

  it("génère un badge v1, écrit les fichiers et passe le participant à BADGED", async () => {
    const participant = await makeConfirmedParticipant();

    const badge = await generateBadge(participant.id, ACTOR);

    expect(badge.version).toBe(1);
    expect(badge.generatedAt).not.toBeNull();
    // Le gabarit figure dans le nom des fichiers.
    expect(badge.pdfPath).toBe(`badges/${participant.publicId}/v1-maquette-2026.pdf`);
    expect(badge.pngPath).toBe(`badges/${participant.publicId}/v1-maquette-2026.png`);

    const pdf = await fileStorage.get(badge.pdfPath!);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const png = await fileStorage.get(badge.pngPath!);
    // 1000 × 1500 px : le rapport 100 × 150 mm du badge.
    expect(png.readUInt32BE(16)).toBe(FORMAT_BADGE.largeurPng);
    expect(png.readUInt32BE(20)).toBe(FORMAT_BADGE.largeurPng * 1.5);

    const reloaded = await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } });
    expect(reloaded.status).toBe("BADGED");
  }, 60_000);

  it("repère un badge rendu avec un ancien gabarit et le refait, même QR", async () => {
    const participant = await makeConfirmedParticipant();
    const badge = await generateBadge(participant.id, ACTOR);
    const avant = await compterAncienGabarit(editionId, {});

    // Badge rendu avec le premier 100 × 150 mm du 25 octobre 2026.
    await prisma.badge.update({
      where: { id: badge.id },
      data: {
        pdfPath: `badges/${participant.publicId}/v1-100x150.pdf`,
        pngPath: `badges/${participant.publicId}/v1-100x150.png`,
      },
    });
    expect(await compterAncienGabarit(editionId, {})).toBe(avant + 1);

    // Ce que fait le job mis en file par « Refaire … avec la nouvelle maquette ».
    const refait = await generateBadge(participant.id, ACTOR, { notifier: false });
    expect(refait.id).toBe(badge.id);
    expect(refait.version).toBe(1);
    expect(refait.qrToken).toBe(badge.qrToken);
    expect(refait.pngPath).toBe(`badges/${participant.publicId}/v1-maquette-2026.png`);
    expect(await compterAncienGabarit(editionId, {})).toBe(avant);
  }, 60_000);

  it("valide le QR émis et refuse un jeton falsifié", async () => {
    const participant = await makeConfirmedParticipant();
    await generateBadge(participant.id, ACTOR);

    const token = buildBadgeToken(participant.publicId, 1);
    const result = await verifyBadgeToken(token);

    expect(result.status).toBe("VALID");
    if (result.status !== "VALID") return;
    expect(result.version).toBe(1);
    expect(result.participant.publicId).toBe(participant.publicId);
    expect(result.participant.organization).toBe("ANSD");

    expect((await verifyBadgeToken(`${participant.publicId}.AAAAAAAAAAAAAAAA`)).status).toBe(
      "UNKNOWN",
    );
    expect((await verifyBadgeToken("n'importe quoi")).status).toBe("UNKNOWN");
  }, 60_000);

  it("un QR révoqué scanné renvoie REVOKED, pas UNKNOWN", async () => {
    const participant = await makeConfirmedParticipant();
    const badge = await generateBadge(participant.id, ACTOR);
    const token = buildBadgeToken(participant.publicId, badge.version);

    await revokeBadge(badge.id, "Badge perdu", ACTOR);

    const result = await verifyBadgeToken(token);
    expect(result.status).toBe("REVOKED");
    if (result.status === "REVOKED") expect(result.reason).toBe("Badge perdu");
  }, 60_000);

  it("la réémission invalide l'ancien QR et en produit un nouveau en v2", async () => {
    const participant = await makeConfirmedParticipant();
    await generateBadge(participant.id, ACTOR);
    const oldToken = buildBadgeToken(participant.publicId, 1);

    const reissued = await reissueBadge(participant.id, "Erreur de fonction", ACTOR);
    expect(reissued.version).toBe(2);

    // L'ancien QR est reconnu comme révoqué : l'agent doit pouvoir distinguer
    // « badge retiré » de « faux badge ».
    expect((await verifyBadgeToken(oldToken)).status).toBe("REVOKED");

    const newToken = buildBadgeToken(participant.publicId, 2);
    expect(newToken).not.toBe(oldToken);
    const result = await verifyBadgeToken(newToken);
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") expect(result.version).toBe(2);

    const current = await getCurrentBadge(participant.id);
    expect(current?.version).toBe(2);
  }, 90_000);

  it("compte les impressions", async () => {
    const participant = await makeConfirmedParticipant();
    const badge = await generateBadge(participant.id, ACTOR);

    await recordPrint(badge.id, ACTOR);
    const after = await recordPrint(badge.id, ACTOR);

    expect(after.printedCount).toBe(2);
    expect(after.printedAt).not.toBeNull();
  }, 60_000);

  it("régénère à version constante sans faire régresser un participant déjà badgé", async () => {
    const participant = await makeConfirmedParticipant();
    const first = await generateBadge(participant.id, ACTOR);
    const second = await generateBadge(participant.id, ACTOR);

    expect(second.id).toBe(first.id);
    expect(second.version).toBe(1);
    expect(await prisma.badge.count({ where: { participantId: participant.id } })).toBe(1);
  }, 90_000);
});
