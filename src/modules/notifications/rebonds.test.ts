import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { AvisRebond } from "./avis-rebond";
import { enregistrerAvis } from "./rebonds";

/**
 * Rapprochement d'un avis « Adresse introuvable » avec le journal (10 novembre
 * 2026). La lecture IMAP n'est pas testée ici : seuls l'analyse
 * (`avis-rebond.test.ts`) et le report en base le sont.
 */

const SUFFIXE = randomUUID().slice(0, 8);
let editionId = "";
let categoryId = "";
const invitationIds: string[] = [];
const logIds: string[] = [];

function avis(adresse: string, extra: Partial<AvisRebond> = {}): AvisRebond {
  return {
    messageId: `<avis-${randomUUID()}@mx.google.com>`,
    date: new Date(),
    original: { messageId: null, sujet: null, date: null },
    echecs: [{ adresse, statut: "5.1.1", diagnostic: "550 user unknown" }],
    ...extra,
  };
}

async function creerInvitation(email: string) {
  const invitation = await prisma.invitation.create({
    data: {
      editionId,
      categoryId,
      email,
      firstName: "Astou",
      lastName: `Rebond${SUFFIXE}`,
      token: randomUUID(),
      status: "SENT",
    },
  });
  invitationIds.push(invitation.id);
  return invitation;
}

describe("enregistrerAvis", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    categoryId = (
      await prisma.participantCategory.findFirstOrThrow({
        where: { editionId, code: "PARTICIPANT_NATIONAL" },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.notificationLog.deleteMany({
      where: { OR: [{ id: { in: logIds } }, { invitationId: { in: invitationIds } }] },
    });
    await prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } });
    await prisma.$disconnect();
  }, 30_000);

  it("fait passer l'envoi d'origine en « Rebond », retrouvé par son Message-ID", async () => {
    const email = `rebond-${randomUUID()}@example.test`;
    const invitation = await creerInvitation(email);
    const envoi = await prisma.notificationLog.create({
      data: {
        invitationId: invitation.id,
        templateKey: "invitation",
        channel: "EMAIL",
        to: email,
        status: "SENT",
        sentAt: new Date(),
        providerMessageId: `<envoi-${SUFFIXE}@gmail.com>`,
      },
    });

    const message = avis(email, {
      original: { messageId: `<envoi-${SUFFIXE}@gmail.com>`, sujet: null, date: null },
    });
    expect(await enregistrerAvis(message, new Map())).toBe("nouveau");

    const apres = await prisma.notificationLog.findUniqueOrThrow({ where: { id: envoi.id } });
    expect(apres.status).toBe("BOUNCED");
    expect(apres.error).toMatch(/^Adresse introuvable \(5\.1\.1\)/);
    expect(apres.bounceMessageId).toBe(message.messageId);

    // Relu au passage suivant : rien ne change, rien n'est créé.
    expect(await enregistrerAvis(message, new Map())).toBe("deja-connu");
    expect(await prisma.notificationLog.count({ where: { to: email } })).toBe(1);
  });

  it("crée la ligne d'une invitation partie avant que le journal ne les consigne", async () => {
    const email = `ancienne-${randomUUID()}@example.test`;
    const invitation = await creerInvitation(email);
    const objets = new Map([["Vous êtes invité(e) au Forum", "invitation"]]);

    const message = avis(email, {
      original: {
        messageId: null,
        sujet: "Vous êtes invité(e) au Forum",
        date: new Date("2026-11-10T00:17:00.000Z"),
      },
    });
    expect(await enregistrerAvis(message, objets)).toBe("nouveau");

    const ligne = await prisma.notificationLog.findFirstOrThrow({ where: { to: email } });
    logIds.push(ligne.id);
    expect(ligne).toMatchObject({
      invitationId: invitation.id,
      participantId: null,
      templateKey: "invitation",
      status: "BOUNCED",
    });
    expect(ligne.createdAt.toISOString()).toBe("2026-11-10T00:17:00.000Z");
  });

  it("garde l'avis même quand l'adresse n'est connue de personne", async () => {
    const email = `inconnu-${randomUUID()}@example.test`;
    expect(await enregistrerAvis(avis(email), new Map())).toBe("nouveau");

    const ligne = await prisma.notificationLog.findFirstOrThrow({ where: { to: email } });
    logIds.push(ligne.id);
    expect(ligne).toMatchObject({
      participantId: null,
      invitationId: null,
      templateKey: "inconnu",
    });
  });
});
