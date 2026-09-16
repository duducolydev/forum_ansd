import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { confirmParticipant, createParticipant } from "@/modules/participants/service";
import { evaluerAcces } from "./decision";
import {
  getAccessMatrix,
  getAccessSnapshot,
  grantOverride,
  matrixKey,
  saveAccessMatrix,
} from "./service";

const ACTOR = { type: "SYSTEM" as const };

const emails: string[] = [];
let editionId = "";
let editionCode = "";
let categoryId = "";
let zoneTestId = "";
let zoneTestCode = "";

async function participantConfirme() {
  const email = `acces-${randomUUID()}@example.test`;
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
      jobTitle: "Statisticienne",
      attendsOpening: false,
      attendsInaugural: false,
      attendsAwards: false,
      needsAccommodation: false,
      needsTransport: false,
    },
  });
  if (participant.status !== "CONFIRMED") {
    await confirmParticipant(participant.id, ACTOR);
  }
  return participant;
}

function contexte(zoneCode: string) {
  return {
    zoneCode,
    scanneA: new Date(),
    dernierScanIci: null,
    premierPassageDuJour: false,
  };
}

describe("zones d'accès (brief §2.6)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    editionCode = edition.code;

    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    });
    categoryId = category.id;

    // Une zone dédiée au test : la matrice de l'édition est partagée avec le
    // jeu de démonstration, on n'y touche que par cette porte-là.
    zoneTestCode = `ZTEST_${randomUUID().slice(0, 8).toUpperCase().replace(/-/g, "")}`;
    const zone = await prisma.zone.create({
      data: { editionId, code: zoneTestCode, name: `Zone de test ${zoneTestCode}` },
    });
    zoneTestId = zone.id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.zone.deleteMany({ where: { id: zoneTestId } });
    await prisma.$disconnect();
  }, 30_000);

  it("résout les zones d'un participant depuis la matrice de sa catégorie", async () => {
    const participant = await participantConfirme();
    const snapshot = await getAccessSnapshot(editionId, participant.publicId);

    expect(snapshot).not.toBeNull();
    expect(snapshot!.zones).toContain("ENTREE");
    expect(snapshot!.zones).toContain("PLENIERE");
    expect(snapshot!.zones).not.toContain("VIP");
    expect(snapshot!.statut).toBe("CONFIRMED");
    expect(snapshot!.revoque).toBe(false);
  });

  it("rend le même verdict que la décision embarquée pour les mêmes données", async () => {
    const participant = await participantConfirme();
    const snapshot = await getAccessSnapshot(editionId, participant.publicId);

    expect(evaluerAcces(snapshot, contexte("ENTREE")).resultat).toBe("OK");
    expect(evaluerAcces(snapshot, contexte("VIP")).resultat).toBe("DENIED_ZONE");
  });

  it("ouvre une zone à un individu par exception, sans toucher à sa catégorie", async () => {
    const participant = await participantConfirme();

    expect(
      evaluerAcces(await getAccessSnapshot(editionId, participant.publicId), contexte(zoneTestCode))
        .resultat,
    ).toBe("DENIED_ZONE");

    await grantOverride(
      editionId,
      {
        participantPublicId: participant.publicId,
        zoneId: zoneTestId,
        reason: "Accompagne la délégation, accès ponctuel",
      },
      ACTOR,
    );

    const apres = await getAccessSnapshot(editionId, participant.publicId);
    expect(apres!.zones).toContain(zoneTestCode);
    expect(evaluerAcces(apres, contexte(zoneTestCode)).resultat).toBe("OK");

    // Un voisin de la même catégorie ne doit rien avoir gagné.
    const voisin = await participantConfirme();
    const snapshotVoisin = await getAccessSnapshot(editionId, voisin.publicId);
    expect(snapshotVoisin!.zones).not.toContain(zoneTestCode);
  });

  it("refuse un badge révoqué même si toutes les zones lui sont ouvertes", async () => {
    const participant = await participantConfirme();
    await prisma.badge.create({
      data: {
        participantId: participant.id,
        version: 1,
        qrToken: `test-${randomUUID()}`,
        revokedAt: new Date(),
        revokeReason: "Perte déclarée",
      },
    });

    const snapshot = await getAccessSnapshot(editionId, participant.publicId);
    expect(snapshot!.revoque).toBe(true);
    expect(evaluerAcces(snapshot, contexte("ENTREE")).resultat).toBe("REVOKED");
  });

  it("n'écrit que les cases réellement modifiées et ignore une clé fabriquée", async () => {
    const avant = await getAccessMatrix(editionId);
    const etatInitial = [...avant.allowed];
    const cle = matrixKey(categoryId, zoneTestId);
    expect(etatInitial).not.toContain(cle);

    const resultat = await saveAccessMatrix(
      editionId,
      [...etatInitial, cle, "categorie-inventee:zone-inventee"],
      avant.categories.filter((c) => c.alertOnScan).map((c) => c.id),
      ACTOR,
    );

    expect(resultat.ajouts).toHaveLength(1);
    expect(resultat.retraits).toHaveLength(0);
    expect(resultat.alertes).toHaveLength(0);

    const apres = await getAccessMatrix(editionId);
    expect(apres.allowed.has(cle)).toBe(true);
    expect(apres.allowed.size).toBe(avant.allowed.size + 1);

    // Retour à l'état initial : la matrice est partagée.
    const retour = await saveAccessMatrix(
      editionId,
      etatInitial,
      avant.categories.filter((c) => c.alertOnScan).map((c) => c.id),
      ACTOR,
    );
    expect(retour.retraits).toHaveLength(1);
    expect((await getAccessMatrix(editionId)).allowed.size).toBe(avant.allowed.size);
  });
});
