import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  cancelParticipant,
  checkIn,
  confirmParticipant,
  createParticipant,
  declineParticipant,
  markBadged,
  publicIdPrefix,
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
});
