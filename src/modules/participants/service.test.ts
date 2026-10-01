import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  AccreditationReserveeError,
  cancelParticipant,
  checkIn,
  confirmParticipant,
  createParticipant,
  declineParticipant,
  markBadged,
  reactivateParticipant,
  publicIdPrefix,
  statutInitial,
  type Actor,
} from "./service";
import { DuplicateParticipantEmailError, InvalidParticipantTransitionError } from "./errors";
import type { ParticipantInput } from "./schema";

const actor: Actor = { type: "SYSTEM" };

describe("publicIdPrefix (fonction pure)", () => {
  it("derives the badge prefix from the edition code", () => {
    expect(publicIdPrefix("FID-2026")).toBe("FID26");
  });
});

describe("statut initial d'une inscription", () => {
  it("confirme d'office une catégorie à validation automatique", () => {
    expect(statutInitial({ autoConfirm: true, requiresAccreditation: false })).toBe("CONFIRMED");
  });

  it("n'accrédite jamais la presse d'office, même en validation automatique", () => {
    expect(statutInitial({ autoConfirm: true, requiresAccreditation: true })).toBe("REGISTERED");
  });

  it("valide l'inscription sur place, hors presse", () => {
    expect(statutInitial({ autoConfirm: false, requiresAccreditation: false }, "ONSITE")).toBe(
      "CONFIRMED",
    );
  });

  it("confirme un import : la personne a déjà confirmé sa venue", () => {
    expect(statutInitial({ autoConfirm: false, requiresAccreditation: false }, "IMPORT")).toBe(
      "CONFIRMED",
    );
  });

  it("n'accrédite pas la presse sur place : l'accréditation relève du BackOffice", () => {
    expect(statutInitial({ autoConfirm: false, requiresAccreditation: true }, "ONSITE")).toBe(
      "REGISTERED",
    );
  });
});

describe("machine à états des participants (brief §2.3)", () => {
  const participantIds: string[] = [];

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
    await prisma.$disconnect();
  });

  async function buildInput(
    categoryCode: string,
  ): Promise<{ input: ParticipantInput; editionId: string; editionCode: string }> {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId: edition.id, code: categoryCode },
    });
    return {
      editionId: edition.id,
      editionCode: edition.code,
      input: {
        firstName: "Test",
        lastName: "Participant",
        email: `test-participant-${crypto.randomUUID()}@example.test`,
        country: "Sénégal",
        categoryId: category.id,
        locale: "fr",
        attendsOpening: false,
        attendsInaugural: false,
        attendsClosing: false,
        attendsAwards: false,
        needsAccommodation: false,
        needsTransport: false,
      },
    };
  }

  it("starts at REGISTERED for a manually-validated category (online source)", async () => {
    const { input, editionId, editionCode } = await buildInput("AUTORITE_VIP"); // autoConfirm=false
    const participant = await createParticipant({
      editionId,
      editionCode,
      input,
      source: "ONLINE",
      actor,
    });
    participantIds.push(participant.id);

    expect(participant.status).toBe("REGISTERED");
    expect(participant.publicId).toMatch(/^FID26-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  });

  it("auto-confirms immediately for an auto-confirm category", async () => {
    const { input, editionId, editionCode } = await buildInput("PARTICIPANT_NATIONAL"); // autoConfirm=true
    const participant = await createParticipant({
      editionId,
      editionCode,
      input,
      source: "ONLINE",
      actor,
    });
    participantIds.push(participant.id);

    expect(participant.status).toBe("CONFIRMED");
    expect(participant.confirmedAt).not.toBeNull();
  });

  it("confirms immediately for an onsite registration, regardless of category", async () => {
    const { input, editionId, editionCode } = await buildInput("AUTORITE_VIP"); // autoConfirm=false
    const participant = await createParticipant({
      editionId,
      editionCode,
      input,
      source: "ONSITE",
      actor,
    });
    participantIds.push(participant.id);

    expect(participant.status).toBe("CONFIRMED");
  });

  it("rejects a duplicate email within the same edition", async () => {
    const { input, editionId, editionCode } = await buildInput("AUTORITE_VIP");
    const first = await createParticipant({
      editionId,
      editionCode,
      input,
      source: "ONLINE",
      actor,
    });
    participantIds.push(first.id);

    await expect(
      createParticipant({ editionId, editionCode, input, source: "ONLINE", actor }),
    ).rejects.toThrow(DuplicateParticipantEmailError);
  });

  it("walks the full happy path: REGISTERED → CONFIRMED → BADGED → CHECKED_IN", async () => {
    const { input, editionId, editionCode } = await buildInput("AUTORITE_VIP");
    const created = await createParticipant({
      editionId,
      editionCode,
      input,
      source: "ONLINE",
      actor,
    });
    participantIds.push(created.id);
    expect(created.status).toBe("REGISTERED");

    const confirmed = await confirmParticipant(created.id, actor);
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.confirmedAt).not.toBeNull();

    const badged = await markBadged(created.id, actor);
    expect(badged.status).toBe("BADGED");

    const checkedIn = await checkIn(created.id, actor);
    expect(checkedIn.status).toBe("CHECKED_IN");
  });

  it("accrédite un journaliste : date, trace et code de secours", async () => {
    const { input, editionId, editionCode } = await buildInput("MEDIA"); // accréditation requise
    const created = await createParticipant({
      editionId,
      editionCode,
      input,
      source: "ONLINE",
      actor,
    });
    participantIds.push(created.id);
    expect(created.status).toBe("REGISTERED");
    expect(created.accreditedAt).toBeNull();

    // Sans la permission d'accréditer (agent d'accueil) : refus, dossier intact.
    await expect(confirmParticipant(created.id, actor)).rejects.toThrow(AccreditationReserveeError);
    const intact = await prisma.participant.findUniqueOrThrow({ where: { id: created.id } });
    expect(intact.status).toBe("REGISTERED");

    const accredite = await confirmParticipant(created.id, actor, { peutAccrediter: true });
    expect(accredite.status).toBe("CONFIRMED");
    expect(accredite.accreditedAt).not.toBeNull();

    const trace = await prisma.auditLog.findFirst({
      where: { entityId: created.id, action: "participant.accredit" },
    });
    expect(trace).not.toBeNull();
    // L'e-mail d'accréditation porte un code de secours, valable plusieurs jours.
    const code = await prisma.magicLink.findFirst({ where: { participantId: created.id } });
    expect(code?.expiresAt.getTime()).toBeGreaterThan(Date.now() + 24 * 60 * 60 * 1000);
  });

  it("rejects confirming a participant that is not REGISTERED", async () => {
    const { input, editionId, editionCode } = await buildInput("AUTORITE_VIP");
    const created = await createParticipant({
      editionId,
      editionCode,
      input,
      source: "ONSITE",
      actor,
    }); // already CONFIRMED
    participantIds.push(created.id);

    await expect(confirmParticipant(created.id, actor)).rejects.toThrow(
      InvalidParticipantTransitionError,
    );
  });

  it("rejects skipping BADGED to check in directly from CONFIRMED", async () => {
    const { input, editionId, editionCode } = await buildInput("AUTORITE_VIP");
    const created = await createParticipant({
      editionId,
      editionCode,
      input,
      source: "ONSITE",
      actor,
    });
    participantIds.push(created.id);

    await expect(checkIn(created.id, actor)).rejects.toThrow(InvalidParticipantTransitionError);
  });

  it("allows declining a registered participant, but not a confirmed one", async () => {
    const registered = await buildInput("AUTORITE_VIP");
    const registeredParticipant = await createParticipant({
      ...registered,
      source: "ONLINE",
      actor,
    });
    participantIds.push(registeredParticipant.id);
    const declined = await declineParticipant(registeredParticipant.id, actor);
    expect(declined.status).toBe("DECLINED");

    const confirmed = await buildInput("AUTORITE_VIP");
    const confirmedParticipant = await createParticipant({ ...confirmed, source: "ONSITE", actor });
    participantIds.push(confirmedParticipant.id);
    await expect(declineParticipant(confirmedParticipant.id, actor)).rejects.toThrow(
      InvalidParticipantTransitionError,
    );
  });

  it("allows cancelling a confirmed participant, but not a registered one", async () => {
    const confirmed = await buildInput("AUTORITE_VIP");
    const confirmedParticipant = await createParticipant({ ...confirmed, source: "ONSITE", actor });
    participantIds.push(confirmedParticipant.id);
    const cancelled = await cancelParticipant(confirmedParticipant.id, actor);
    expect(cancelled.status).toBe("CANCELLED");

    const registered = await buildInput("AUTORITE_VIP");
    const registeredParticipant = await createParticipant({
      ...registered,
      source: "ONLINE",
      actor,
    });
    participantIds.push(registeredParticipant.id);
    await expect(cancelParticipant(registeredParticipant.id, actor)).rejects.toThrow(
      InvalidParticipantTransitionError,
    );
  });

  describe("réactivation (1er octobre 2026 : rattraper une annulation faite par erreur)", () => {
    it("rend à un participant annulé le statut qu'il avait — confirmé", async () => {
      const donnees = await buildInput("AUTORITE_VIP");
      const participant = await createParticipant({ ...donnees, source: "ONSITE", actor });
      participantIds.push(participant.id);
      await cancelParticipant(participant.id, actor);

      const reactive = await reactivateParticipant(participant.id, actor);
      expect(reactive.status).toBe("CONFIRMED");
      const trace = await prisma.auditLog.findFirst({
        where: { entityId: participant.id, action: "participant.reactivate" },
      });
      expect(trace?.before).toEqual({ status: "CANCELLED" });
      expect(trace?.after).toEqual({ status: "CONFIRMED" });
    });

    it("rend « badgé » quand le badge est toujours valide", async () => {
      const donnees = await buildInput("AUTORITE_VIP");
      const participant = await createParticipant({ ...donnees, source: "ONSITE", actor });
      participantIds.push(participant.id);
      await prisma.badge.create({
        data: { participantId: participant.id, qrToken: `test-${crypto.randomUUID()}` },
      });
      await markBadged(participant.id, actor);
      await cancelParticipant(participant.id, actor);

      expect((await reactivateParticipant(participant.id, actor)).status).toBe("BADGED");
    });

    it("repart confirmé quand le badge a été révoqué entre-temps", async () => {
      const donnees = await buildInput("AUTORITE_VIP");
      const participant = await createParticipant({ ...donnees, source: "ONSITE", actor });
      participantIds.push(participant.id);
      await prisma.badge.create({
        data: {
          participantId: participant.id,
          qrToken: `test-${crypto.randomUUID()}`,
          revokedAt: new Date(),
        },
      });
      await markBadged(participant.id, actor);
      await cancelParticipant(participant.id, actor);

      expect((await reactivateParticipant(participant.id, actor)).status).toBe("CONFIRMED");
    });

    it("rend « inscrit » à une inscription déclinée", async () => {
      const donnees = await buildInput("AUTORITE_VIP");
      const participant = await createParticipant({ ...donnees, source: "ONLINE", actor });
      participantIds.push(participant.id);
      await declineParticipant(participant.id, actor);

      expect((await reactivateParticipant(participant.id, actor)).status).toBe("REGISTERED");
    });

    it("refuse de réactiver un participant qui n'est ni annulé ni décliné", async () => {
      const donnees = await buildInput("AUTORITE_VIP");
      const participant = await createParticipant({ ...donnees, source: "ONSITE", actor });
      participantIds.push(participant.id);

      await expect(reactivateParticipant(participant.id, actor)).rejects.toThrow(
        InvalidParticipantTransitionError,
      );
    });
  });
});
