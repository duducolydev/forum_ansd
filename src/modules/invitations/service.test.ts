import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createParticipant } from "@/modules/participants/service";
import {
  createInvitation,
  generateInvitationToken,
  importInvitations,
  previewImport,
  type ParsedImportRow,
} from "./service";

const actor = { type: "SYSTEM" as const };

describe("generateInvitationToken (fonction pure)", () => {
  it("returns a URL-safe, sufficiently random token", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a.length).toBeGreaterThan(20);
  });
});

describe("rapprochement automatique par email (brief §5.5)", () => {
  const invitationIds: string[] = [];
  const participantIds: string[] = [];

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
    await prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } });
    await prisma.$disconnect();
  });

  it("links a pending invitation to a participant who registers outside the personalised link", async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId: edition.id, code: "AUTORITE_VIP" },
    });
    const email = `reconcile-${crypto.randomUUID()}@example.test`;

    const invitation = await createInvitation(
      edition.id,
      { email, firstName: "Test", lastName: "Reconcile", categoryId: category.id },
      actor,
    );
    invitationIds.push(invitation.id);
    expect(invitation.status).toBe("PENDING");

    const participant = await createParticipant({
      editionId: edition.id,
      editionCode: edition.code,
      source: "ONLINE",
      actor,
      input: {
        firstName: "Test",
        lastName: "Reconcile",
        email,
        country: "Sénégal",
        categoryId: category.id,
        locale: "fr",
        attendsOpening: false,
        attendsInaugural: false,
        attendsAwards: false,
        needsAccommodation: false,
        needsTransport: false,
      },
    });
    participantIds.push(participant.id);

    const reconciled = await prisma.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
      include: { participant: true },
    });
    expect(reconciled.status).toBe("REGISTERED");
    expect(reconciled.participant?.id).toBe(participant.id);
    expect(reconciled.respondedAt).not.toBeNull();
  });
});

describe("import en masse (brief §5.5 : 1000 lignes < 10 s)", () => {
  const createdBatchIds: string[] = [];

  afterAll(async () => {
    await prisma.invitation.deleteMany({ where: { importBatchId: { in: createdBatchIds } } });
    await prisma.$disconnect();
  });

  it("previews and imports 1000 rows in under 10 seconds", async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    const categories = await prisma.participantCategory.findMany({
      where: { editionId: edition.id },
    });
    const categoryCodeToId = new Map(categories.map((category) => [category.code, category.id]));
    const categoryCode = categories[0].code;

    const rows: ParsedImportRow[] = Array.from({ length: 1000 }, (_, index) => ({
      rowNumber: index + 2,
      raw: {
        email: `bulk-import-${index}-${crypto.randomUUID()}@example.test`,
        firstName: `Prénom${index}`,
        lastName: `Nom${index}`,
        categoryCode,
      },
    }));

    const start = Date.now();
    const preview = await previewImport(edition.id, rows, categoryCodeToId);
    expect(preview.errors).toHaveLength(0);
    expect(preview.valid).toHaveLength(1000);

    const summary = await importInvitations(edition.id, preview.valid, categoryCodeToId, actor);
    createdBatchIds.push(summary.batchId);
    const elapsedMs = Date.now() - start;

    expect(summary.imported).toBe(1000);
    expect(elapsedMs).toBeLessThan(10_000);
  }, 15_000);
});
