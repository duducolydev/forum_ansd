import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { buildBadgeToken, hashBadgeToken } from "@/modules/badges/token";
import { confirmParticipant, createParticipant } from "@/modules/participants/service";
import { buildManifeste, etagManifeste } from "./manifest";
import { enregistrerScans, marquerPresences } from "./service";
import type { ScanEntry } from "./schema";

const ACTOR = { type: "SYSTEM" as const };

const emails: string[] = [];
let editionId = "";
let editionCode = "";
let categoryId = "";
let zoneId = "";
let zoneCode = "";
let checkpointId = "";

async function participantAvecBadge(version = 1) {
  const email = `scan-${randomUUID()}@example.test`;
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

  // Le badge est créé directement : le rendu PDF exige Chromium et n'apporte
  // rien à ce qu'on vérifie ici, qui est le contenu du manifeste.
  for (let v = 1; v <= version; v++) {
    await prisma.badge.create({
      data: {
        participantId: participant.id,
        version: v,
        qrToken: hashBadgeToken(buildBadgeToken(participant.publicId, v)),
        generatedAt: new Date(),
      },
    });
  }

  return participant;
}

function scan(surcharge: Partial<ScanEntry> = {}): ScanEntry {
  return {
    clientScanId: randomUUID(),
    checkpointId,
    tokenHash: "0".repeat(64),
    scannedAt: new Date().toISOString(),
    direction: "IN",
    result: "OK",
    ...surcharge,
  };
}

describe("scanner hors ligne (brief §5.6)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    editionCode = edition.code;

    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    });
    categoryId = category.id;

    zoneCode = `ZSCAN_${randomUUID().slice(0, 8).toUpperCase()}`;
    const zone = await prisma.zone.create({
      data: { editionId, code: zoneCode, name: `Zone scan ${zoneCode}` },
    });
    zoneId = zone.id;

    const checkpoint = await prisma.checkpoint.create({
      data: { editionId, zoneId, name: `Poste ${zoneCode}` },
    });
    checkpointId = checkpoint.id;
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({ where: { checkpointId } });
    await prisma.checkpoint.deleteMany({ where: { id: checkpointId } });
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.zone.deleteMany({ where: { id: zoneId } });
    await prisma.$disconnect();
  }, 30_000);

  describe("manifeste", () => {
    it("embarque l'empreinte du badge et les zones résolues, sans donnée superflue", async () => {
      const participant = await participantAvecBadge();
      const manifeste = await buildManifeste(editionId, editionCode);

      const entree = manifeste.entrees.find((ligne) => ligne.publicId === participant.publicId);
      expect(entree).toBeDefined();
      expect(entree!.h).toBe(hashBadgeToken(buildBadgeToken(participant.publicId, 1)));
      expect(entree!.zones).toContain("ENTREE");
      expect(entree!.revoque).toBe(false);

      // §2.11 : ni e-mail ni téléphone ne doivent quitter le serveur.
      const serialise = JSON.stringify(manifeste);
      expect(serialise).not.toContain(participant.email);
      expect(serialise).not.toContain("phone");
    });

    it("marque révoquée toute version antérieure à la courante", async () => {
      const participant = await participantAvecBadge(2);
      const manifeste = await buildManifeste(editionId, editionCode);

      const versions = manifeste.entrees.filter((ligne) => ligne.publicId === participant.publicId);
      expect(versions).toHaveLength(2);

      const v1 = hashBadgeToken(buildBadgeToken(participant.publicId, 1));
      const v2 = hashBadgeToken(buildBadgeToken(participant.publicId, 2));
      // L'ancien QR doit dire « révoqué », pas « inconnu » : sinon l'agent
      // conclut à une erreur de lecture et laisse repartir le porteur.
      expect(versions.find((ligne) => ligne.h === v1)!.revoque).toBe(true);
      expect(versions.find((ligne) => ligne.h === v2)!.revoque).toBe(false);
    });

    it("garde un ETag stable quand seul l'horodatage change", async () => {
      /*
       * Le manifeste couvre **toute l'édition**, et la suite tourne à plusieurs
       * fichiers de front sur la même base : comparer deux lectures successives
       * revenait à parier qu'aucun autre test ne crée un badge entre les deux.
       * Le pari a fini par être perdu. La propriété visée — l'horodatage n'entre
       * pas dans le calcul, sans quoi le 304 ne servirait jamais — se vérifie
       * sur une seule lecture, dont on ne change que l'heure.
       */
      const manifeste = await buildManifeste(editionId, editionCode);
      const plusTard = {
        ...manifeste,
        genereLe: new Date(Date.parse(manifeste.genereLe) + 60_000).toISOString(),
      };

      expect(plusTard.genereLe).not.toBe(manifeste.genereLe);
      expect(etagManifeste(plusTard)).toBe(etagManifeste(manifeste));
    });

    it("change d'ETag dès qu'un badge entre dans le périmètre", async () => {
      const avant = etagManifeste(await buildManifeste(editionId, editionCode));
      await participantAvecBadge();
      expect(etagManifeste(await buildManifeste(editionId, editionCode))).not.toBe(avant);
    });
  });

  describe("synchronisation des scans", () => {
    it("enregistre un lot et rattache le participant par son empreinte", async () => {
      const participant = await participantAvecBadge();
      const empreinte = hashBadgeToken(buildBadgeToken(participant.publicId, 1));

      const resultat = await enregistrerScans(
        editionId,
        [scan({ tokenHash: empreinte })],
        undefined,
      );

      expect(resultat).toMatchObject({ recus: 1, enregistres: 1, doublons: 0, rejetes: 0 });
      const ligne = await prisma.scanLog.findFirstOrThrow({
        where: { checkpointId, participantId: participant.id },
      });
      expect(ligne.result).toBe("OK");
      expect(ligne.badgeVersion).toBe(1);
    });

    it("ignore un lot renvoyé — c'est ce qui rend la reprise réseau sûre", async () => {
      const participant = await participantAvecBadge();
      const lot = [scan({ tokenHash: hashBadgeToken(buildBadgeToken(participant.publicId, 1)) })];

      const premier = await enregistrerScans(editionId, lot, undefined);
      const second = await enregistrerScans(editionId, lot, undefined);

      expect(premier.enregistres).toBe(1);
      expect(second.enregistres).toBe(0);
      expect(second.doublons).toBe(1);
      expect(await prisma.scanLog.count({ where: { clientScanId: lot[0]!.clientScanId } })).toBe(1);
    });

    it("ramène à UNKNOWN un verdict favorable portant sur une empreinte inconnue", async () => {
      const entree = scan({ result: "OK", tokenHash: "a".repeat(64) });
      await enregistrerScans(editionId, [entree], undefined);

      const ligne = await prisma.scanLog.findFirstOrThrow({
        where: { clientScanId: entree.clientScanId },
      });
      expect(ligne.result).toBe("UNKNOWN");
      expect(ligne.participantId).toBeNull();
    });

    it("rejette un scan visant un point de contrôle étranger à l'édition", async () => {
      const resultat = await enregistrerScans(
        editionId,
        [scan({ checkpointId: "point-inexistant" })],
        undefined,
      );
      expect(resultat).toMatchObject({ enregistres: 0, rejetes: 1 });
    });

    it("passe le participant à CHECKED_IN au premier passage autorisé", async () => {
      const participant = await participantAvecBadge();
      const entree = scan({
        tokenHash: hashBadgeToken(buildBadgeToken(participant.publicId, 1)),
      });

      await enregistrerScans(editionId, [entree], undefined);
      const marques = await marquerPresences([entree.clientScanId]);

      expect(marques).toBe(1);
      const recharge = await prisma.participant.findUniqueOrThrow({
        where: { id: participant.id },
      });
      expect(recharge.status).toBe("CHECKED_IN");
    });

    it("ne marque aucune présence sur un refus", async () => {
      const participant = await participantAvecBadge();
      const entree = scan({
        tokenHash: hashBadgeToken(buildBadgeToken(participant.publicId, 1)),
        result: "DENIED_ZONE",
      });

      await enregistrerScans(editionId, [entree], undefined);
      expect(await marquerPresences([entree.clientScanId])).toBe(0);
    });
  });
});
