import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createParticipant } from "@/modules/participants/service";
import {
  createInvitation,
  dureeCampagneMinutes,
  ENVOIS_PAR_MINUTE,
  generateInvitationToken,
  importInvitations,
  momentEnvoi,
  previewImport,
  sendPendingInvitations,
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

/*
 * Cadence d'envoi (PLAN.md §22).
 *
 * Une campagne met un message en file par destinataire. Sans étalement, mille
 * invitations partent en quelques secondes et la boîte d'envoi coupe le robinet.
 */
describe("cadence d'une campagne d'invitations", () => {
  const depart = new Date("2026-10-05T08:00:00.000Z");

  it("étale les envois au rythme annoncé", () => {
    expect(momentEnvoi(0, depart).getTime()).toBe(depart.getTime());
    // Le 21e message part une minute après le premier.
    expect(momentEnvoi(ENVOIS_PAR_MINUTE, depart).getTime() - depart.getTime()).toBe(60_000);
    const parMinute = Array.from({ length: 60 }, (_, index) => momentEnvoi(index, depart)).filter(
      (moment) => moment.getTime() - depart.getTime() < 60_000,
    );
    expect(parMinute).toHaveLength(ENVOIS_PAR_MINUTE);
  });

  it("ne programme jamais deux envois au même instant", () => {
    const moments = Array.from({ length: 200 }, (_, index) => momentEnvoi(index, depart).getTime());
    expect(new Set(moments).size).toBe(moments.length);
    expect([...moments].sort((a, b) => a - b)).toEqual(moments);
  });

  it("annonce une durée cohérente avec la cadence", () => {
    expect(dureeCampagneMinutes(0)).toBe(0);
    expect(dureeCampagneMinutes(1)).toBe(0);
    expect(dureeCampagneMinutes(ENVOIS_PAR_MINUTE)).toBe(1);
    // Mille invitations : moins d'une heure, et la durée annoncée le dit.
    expect(dureeCampagneMinutes(1000)).toBe(Math.ceil(999 / ENVOIS_PAR_MINUTE));
    expect(dureeCampagneMinutes(1000)).toBeLessThan(60);
  });
});

describe("envoi groupé des invitations en attente", () => {
  const identifiants: string[] = [];
  let categorieId = "";
  let editionId = "";

  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    // Catégorie dédiée : sans elle, la campagne viserait toutes les invitations
    // en attente de la base — mille et plus sur une instance réelle.
    const categorie = await prisma.participantCategory.create({
      data: {
        editionId,
        code: `TEST-CAMPAGNE-${crypto.randomUUID().slice(0, 8)}`,
        labelFr: "Campagne (test)",
        labelEn: "Campaign (test)",
        isActive: false,
      },
    });
    categorieId = categorie.id;
  });

  afterAll(async () => {
    // Les jobs des tests vivent dans une file Redis propre au processus
    // (`QUEUE_NAME` dans `vitest.setup.ts`) : aucun worker de l'application ne
    // les consomme, et rien n'est à nettoyer en base.
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [...identifiants, editionId] } } });
    await prisma.invitation.deleteMany({ where: { categoryId: categorieId } });
    await prisma.participantCategory.deleteMany({ where: { id: categorieId } });
    await prisma.$disconnect();
  });

  it("ne met en file que les invitations jamais envoyées, et les étale", async () => {
    const aEnvoyer = await createInvitation(
      editionId,
      {
        email: `campagne-attente-${crypto.randomUUID()}@example.test`,
        firstName: "Awa",
        lastName: "Ndiaye",
        categoryId: categorieId,
      },
      actor,
    );
    const seconde = await createInvitation(
      editionId,
      {
        email: `campagne-attente2-${crypto.randomUUID()}@example.test`,
        firstName: "Bineta",
        lastName: "Sarr",
        categoryId: categorieId,
      },
      actor,
    );
    const dejaEnvoyee = await createInvitation(
      editionId,
      {
        email: `campagne-envoyee-${crypto.randomUUID()}@example.test`,
        firstName: "Modou",
        lastName: "Fall",
        categoryId: categorieId,
      },
      actor,
    );
    identifiants.push(aEnvoyer.id, seconde.id, dejaEnvoyee.id);
    await prisma.invitation.update({
      where: { id: dejaEnvoyee.id },
      data: { status: "SENT", sentAt: new Date() },
    });

    // Deux invitations en attente sur trois : celle déjà partie relève de la
    // relance, pas de la campagne.
    const resultat = await sendPendingInvitations(editionId, { categoryId: categorieId }, actor);
    expect(resultat.queued).toBe(2);

    // Les deux mises en file restent « à envoyer » jusqu'au traitement du job.
    const apres = await prisma.invitation.findMany({
      where: { id: { in: [aEnvoyer.id, seconde.id] } },
      select: { status: true },
    });
    expect(apres.map((invitation) => invitation.status)).toEqual(["PENDING", "PENDING"]);

    // Relancer la campagne aussitôt ne double pas les envois côté file : la clé
    // d'idempotence porte l'identifiant de l'invitation et l'heure de départ.
    const seconde_campagne = await sendPendingInvitations(
      editionId,
      { categoryId: categorieId },
      actor,
    );
    expect(seconde_campagne.queued).toBe(2);
  });

  it("met mille invitations en file en moins de dix secondes", async () => {
    /*
     * Le défaut mesuré : un job **et** une ligne d'audit par destinataire, soit
     * plus de deux mille écritures, faisaient dépasser les 30 s — au-delà du
     * temps d'une requête. La mise en file groupée tient la campagne du Forum.
     */
    const lignes = Array.from({ length: 1000 }, (_, index) => ({
      editionId,
      categoryId: categorieId,
      email: `campagne-mille-${index}-${crypto.randomUUID()}@example.test`,
      firstName: `Prénom${index}`,
      lastName: `Nom${index}`,
      token: generateInvitationToken(),
    }));
    await prisma.invitation.createMany({ data: lignes });

    const debut = Date.now();
    const resultat = await sendPendingInvitations(editionId, { categoryId: categorieId }, actor);
    const duree = Date.now() - debut;

    expect(resultat.queued).toBeGreaterThanOrEqual(1000);
    expect(duree).toBeLessThan(10_000);
    // Et la durée annoncée à l'agent correspond à la cadence.
    expect(resultat.dureeMinutes).toBe(dureeCampagneMinutes(resultat.queued));
  }, 30_000);
});
