import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { jobQueue } from "@/lib/queue";
import { fileStorage } from "@/lib/storage";
import { supprimerDefinitivement } from "./suppression";

describe("suppression définitive d'un participant", () => {
  const participantIds: string[] = [];
  const invitationIds: string[] = [];
  const sessionIds: string[] = [];

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
    await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
    await prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } });
    await prisma.$disconnect();
  });

  it("efface la fiche, ses fichiers et ses traces, puis libère l'adresse", async () => {
    const enqueue = vi.spyOn(jobQueue, "enqueue").mockResolvedValue(undefined);
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    const categorie = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId: edition.id, code: "PARTICIPANT_NATIONAL" },
    });
    const suffixe = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
    const publicId = `SUP-${suffixe}`;
    const email = `suppression-${suffixe.toLowerCase()}@example.test`;
    const fiche = {
      editionId: edition.id,
      firstName: "Awa",
      lastName: "Suppression",
      country: "Sénégal",
      categoryId: categorie.id,
    };

    // Invitation consommée par l'inscription : elle doit se rouvrir.
    const invitation = await prisma.invitation.create({
      data: {
        editionId: edition.id,
        email,
        firstName: "Awa",
        lastName: "Suppression",
        categoryId: categorie.id,
        token: `suppression-${suffixe}`,
        status: "REGISTERED",
        sentAt: new Date(),
        respondedAt: new Date(),
      },
    });
    invitationIds.push(invitation.id);

    const participant = await prisma.participant.create({
      data: {
        ...fiche,
        publicId,
        email,
        // Inscrit et non badgé : hors du décompte des badges à refaire, que
        // `badges/service.test.ts` vérifie en parallèle sur toute l'édition.
        status: "REGISTERED",
        photoPath: `photos/${publicId}-test.jpg`,
        invitationId: invitation.id,
      },
    });
    participantIds.push(participant.id);

    // Photo, badge courant, et un fichier d'un ancien gabarit que rien ne désigne plus.
    await fileStorage.put(`photos/${publicId}-test.jpg`, Buffer.from("photo"));
    await fileStorage.put(`badges/${publicId}/v1-ancien.pdf`, Buffer.from("ancien"));
    await fileStorage.put(`badges/${publicId}/v1-courant.pdf`, Buffer.from("pdf"));
    await fileStorage.put(`badges/${publicId}/v1-courant.png`, Buffer.from("png"));
    const badge = await prisma.badge.create({
      data: {
        participantId: participant.id,
        qrToken: `suppression-${suffixe}`,
        generatedAt: new Date(),
        pdfPath: `badges/${publicId}/v1-courant.pdf`,
        pngPath: `badges/${publicId}/v1-courant.png`,
      },
    });

    // Session pleine : la place libérée revient au premier en attente.
    const session = await prisma.session.create({
      data: {
        editionId: edition.id,
        slug: `suppression-${suffixe.toLowerCase()}`,
        type: "PANEL",
        titleFr: `Panel suppression ${suffixe}`,
        titleEn: "Deletion panel",
        day: new Date("2026-11-25T00:00:00.000Z"),
        startTime: new Date("2026-11-25T16:00:00.000Z"),
        endTime: new Date("2026-11-25T17:00:00.000Z"),
        capacity: 1,
        registrationOpen: true,
        waitlistEnabled: true,
      },
    });
    sessionIds.push(session.id);
    const enAttente = await prisma.participant.create({
      data: {
        ...fiche,
        publicId: `SUP-${suffixe}W`,
        email: `attente-${suffixe.toLowerCase()}@example.test`,
      },
    });
    participantIds.push(enAttente.id);
    await prisma.sessionRegistration.createMany({
      data: [
        { sessionId: session.id, participantId: participant.id, status: "REGISTERED" },
        {
          sessionId: session.id,
          participantId: enAttente.id,
          status: "WAITLISTED",
          waitlistPosition: 1,
        },
      ],
    });

    await prisma.notificationLog.create({
      data: {
        participantId: participant.id,
        templateKey: "registration_received",
        channel: "EMAIL",
        to: email,
        status: "SENT",
      },
    });
    const pointDeControle = await prisma.checkpoint.findFirst({
      where: { editionId: edition.id },
    });
    if (pointDeControle) {
      await prisma.scanLog.create({
        data: {
          participantId: participant.id,
          badgeId: badge.id,
          badgeVersion: 1,
          checkpointId: pointDeControle.id,
          day: new Date("2026-11-23T00:00:00.000Z"),
          result: "OK",
          clientScanId: randomUUID(),
        },
      });
    }

    await supprimerDefinitivement(participant.id, { type: "SYSTEM" });

    expect(await prisma.participant.findUnique({ where: { id: participant.id } })).toBeNull();
    expect(await prisma.badge.count({ where: { participantId: participant.id } })).toBe(0);
    expect(await prisma.notificationLog.count({ where: { participantId: participant.id } })).toBe(
      0,
    );
    expect(await prisma.scanLog.count({ where: { badgeId: badge.id } })).toBe(0);
    expect(
      await prisma.sessionRegistration.count({ where: { participantId: participant.id } }),
    ).toBe(0);

    for (const chemin of [
      `photos/${publicId}-test.jpg`,
      `badges/${publicId}/v1-ancien.pdf`,
      `badges/${publicId}/v1-courant.pdf`,
    ]) {
      await expect(fileStorage.get(chemin)).rejects.toThrow();
    }

    const promu = await prisma.sessionRegistration.findUniqueOrThrow({
      where: { sessionId_participantId: { sessionId: session.id, participantId: enAttente.id } },
    });
    expect(promu.status).toBe("REGISTERED");
    expect(enqueue).toHaveBeenCalledWith(
      "notification.send",
      expect.objectContaining({ templateKey: "session_promoted", participantId: enAttente.id }),
      expect.anything(),
    );

    const rouverte = await prisma.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    expect(rouverte.status).toBe("SENT");
    expect(rouverte.respondedAt).toBeNull();

    const trace = await prisma.auditLog.findFirst({
      where: { action: "participant.purge", entityId: participant.id },
    });
    expect(trace?.before).toMatchObject({ publicId, email });

    // L'adresse est libre : une nouvelle inscription passe l'unicité (édition, e-mail).
    const reinscrit = await prisma.participant.create({
      data: { ...fiche, publicId: `SUP-${suffixe}R`, email },
    });
    participantIds.push(reinscrit.id);
    enqueue.mockRestore();
  });
});
