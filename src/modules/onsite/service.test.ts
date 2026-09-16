import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resolveBrowserPath } from "@/lib/pdf";
import { finaliser, rechercher, OnsiteError } from "./service";

const ACTOR = { type: "SYSTEM" as const };
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();

const emails: string[] = [];
let editionId = "";
let categoryId = "";
let zoneId = "";
let checkpointId = "";

async function creerParticipant(
  nom: string,
  statut: "INVITED" | "REGISTERED" | "CONFIRMED" | "CANCELLED",
  extra: Record<string, unknown> = {},
) {
  const email = `onsite-${randomUUID()}@example.test`;
  emails.push(email);
  return prisma.participant.create({
    data: {
      editionId,
      publicId: `ONS-${SUFFIXE}-${emails.length}`,
      firstName: "Aminata",
      lastName: nom,
      email,
      country: "Sénégal",
      organization: "ANSD",
      categoryId,
      status: statut,
      source: "ONSITE",
      confirmedAt: statut === "CONFIRMED" ? new Date() : null,
      ...extra,
    },
  });
}

describe("comptoir d'accueil (brief §5.7)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    categoryId = (
      await prisma.participantCategory.findFirstOrThrow({
        where: { editionId, code: "PARTICIPANT_NATIONAL" },
      })
    ).id;

    const zone = await prisma.zone.create({
      data: { editionId, code: `ZONS${SUFFIXE}`, name: `Zone accueil ${SUFFIXE}` },
    });
    zoneId = zone.id;
    // La zone doit être ouverte à la catégorie, sinon le passage serait refusé.
    await prisma.categoryZone.create({ data: { categoryId, zoneId } });
    checkpointId = (
      await prisma.checkpoint.create({
        data: { editionId, zoneId, name: `Comptoir ${SUFFIXE}` },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({ where: { checkpointId } });
    await prisma.checkpoint.deleteMany({ where: { id: checkpointId } });
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.zone.deleteMany({ where: { id: zoneId } });
    await prisma.$disconnect();
  }, 30_000);

  describe("recherche", () => {
    it("trouve par nom, par organisation et par identifiant", async () => {
      const participant = await creerParticipant(`Sow${SUFFIXE}`, "REGISTERED");

      expect((await rechercher(editionId, `Sow${SUFFIXE}`)).map((c) => c.id)).toContain(
        participant.id,
      );
      expect((await rechercher(editionId, participant.publicId)).map((c) => c.id)).toContain(
        participant.id,
      );
      expect((await rechercher(editionId, participant.email)).map((c) => c.id)).toContain(
        participant.id,
      );
    });

    it("ne répond rien en dessous de deux caractères", async () => {
      // Sinon la première lettre tapée ramènerait toute la base.
      expect(await rechercher(editionId, "a")).toEqual([]);
      expect(await rechercher(editionId, " ")).toEqual([]);
    });

    it("écarte les inscriptions annulées", async () => {
      const annule = await creerParticipant(`Annule${SUFFIXE}`, "CANCELLED");
      expect((await rechercher(editionId, `Annule${SUFFIXE}`)).map((c) => c.id)).not.toContain(
        annule.id,
      );
    });

    it("dit ce qu'il reste à faire pour chaque candidat", async () => {
      const participant = await creerParticipant(`Statut${SUFFIXE}`, "INVITED");
      const [candidat] = await rechercher(editionId, `Statut${SUFFIXE}`);
      expect(candidat).toMatchObject({ statut: "INVITED", aBadge: false });
      expect(candidat!.id).toBe(participant.id);
    });
  });

  describe("finalisation", () => {
    it("refuse une inscription annulée plutôt que de délivrer un badge", async () => {
      const annule = await creerParticipant(`Refus${SUFFIXE}`, "CANCELLED");
      await expect(finaliser(editionId, annule.id, ACTOR, checkpointId)).rejects.toBeInstanceOf(
        OnsiteError,
      );
    });
  });

  // Le rendu du badge exige Chromium : ces cas ne s'exécutent que là où il est
  // disponible, comme les tests de badges.
  describe.skipIf(!resolveBrowserPath())("finalisation avec badge", () => {
    it("valide, badge et enregistre la présence en une passe", async () => {
      const participant = await creerParticipant(`Complet${SUFFIXE}`, "REGISTERED");

      const resultat = await finaliser(editionId, participant.id, ACTOR, checkpointId);

      expect(resultat.badgeExistant).toBe(false);
      expect(resultat.presenceEnregistree).toBe(true);

      const recharge = await prisma.participant.findUniqueOrThrow({
        where: { id: participant.id },
      });
      expect(recharge.status).toBe("CHECKED_IN");

      const scans = await prisma.scanLog.count({
        where: { checkpointId, participantId: participant.id, result: "OK" },
      });
      expect(scans).toBe(1);
    }, 60_000);

    it("ne réédite pas un badge déjà valide", async () => {
      const participant = await creerParticipant(`Rejoue${SUFFIXE}`, "CONFIRMED");

      const premier = await finaliser(editionId, participant.id, ACTOR, checkpointId);
      const second = await finaliser(editionId, participant.id, ACTOR, checkpointId);

      expect(premier.badgeExistant).toBe(false);
      expect(second.badgeExistant).toBe(true);
      expect(second.badgeId).toBe(premier.badgeId);

      // Un seul badge en base : repasser au comptoir ne doit pas en créer un
      // second, qui invaliderait le premier déjà imprimé.
      expect(await prisma.badge.count({ where: { participantId: participant.id } })).toBe(1);
    }, 90_000);

    it("fonctionne sans point de contrôle, en le disant", async () => {
      const participant = await creerParticipant(`SansPoint${SUFFIXE}`, "CONFIRMED");
      const resultat = await finaliser(editionId, participant.id, ACTOR, null);

      expect(resultat.badgeId).toBeTruthy();
      expect(resultat.presenceEnregistree).toBe(false);
    }, 60_000);
  });
});
