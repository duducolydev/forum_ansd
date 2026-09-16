import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  annuler,
  inscrire,
  listerInscriptions,
  marquerPresent,
  plafondLibreService,
  RefusInscription,
} from "./registration";

const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();
const JOUR = new Date("2026-11-23T00:00:00.000Z");

const emails: string[] = [];
let editionId = "";
let categoryId = "";
let sessionId = "";
let sessionParallele = "";
const participants: string[] = [];

async function creerParticipant(index: number, statut: "CONFIRMED" | "REGISTERED" = "CONFIRMED") {
  const email = `resa-${randomUUID()}@example.test`;
  emails.push(email);
  const participant = await prisma.participant.create({
    data: {
      editionId,
      publicId: `RESA-${SUFFIXE}-${index}`,
      firstName: "Participant",
      lastName: `Test${index}`,
      email,
      country: "Sénégal",
      categoryId,
      status: statut,
      source: "ONSITE",
      confirmedAt: statut === "CONFIRMED" ? new Date() : null,
    },
  });
  participants.push(participant.id);
  return participant.id;
}

async function creerSession(surcharge: Record<string, unknown> = {}) {
  return prisma.session.create({
    data: {
      editionId,
      slug: `resa-${SUFFIXE}-${randomUUID().slice(0, 6)}`,
      type: "PANEL",
      titleFr: `Panel réservation ${SUFFIXE}`,
      titleEn: "Booking panel",
      day: JOUR,
      startTime: new Date("2026-11-23T11:30:00.000Z"),
      endTime: new Date("2026-11-23T13:00:00.000Z"),
      capacity: 1,
      registrationOpen: true,
      waitlistEnabled: true,
      isPublished: true,
      ...surcharge,
    },
  });
}

describe("réservation des panels (brief §5.5)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    const categorie = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    });
    categoryId = categorie.id;
  });

  afterAll(async () => {
    await prisma.sessionRegistration.deleteMany({
      where: { participantId: { in: participants } },
    });
    await prisma.session.deleteMany({ where: { titleFr: { contains: SUFFIXE } } });
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  }, 30_000);

  beforeEach(async () => {
    sessionId = (await creerSession()).id;
  });

  it("inscrit un participant confirmé", async () => {
    const participantId = await creerParticipant(1);
    expect(await inscrire(sessionId, participantId)).toEqual({ statut: "INSCRIT" });
  });

  it("bascule en liste d'attente une fois la capacité atteinte, avec des positions ordonnées", async () => {
    const premier = await creerParticipant(2);
    const second = await creerParticipant(3);
    const troisieme = await creerParticipant(4);

    await inscrire(sessionId, premier);
    expect(await inscrire(sessionId, second)).toEqual({ statut: "LISTE_ATTENTE", position: 1 });
    expect(await inscrire(sessionId, troisieme)).toEqual({ statut: "LISTE_ATTENTE", position: 2 });
  });

  it("refuse quand la session est complète et la liste d'attente désactivée", async () => {
    const sansAttente = await creerSession({ waitlistEnabled: false });
    await inscrire(sansAttente.id, await creerParticipant(5));

    await expect(inscrire(sansAttente.id, await creerParticipant(6))).rejects.toThrowError(
      expect.objectContaining({ motif: "COMPLET" }),
    );
  });

  it("refuse une inscription non confirmée au Forum", async () => {
    const nonConfirme = await creerParticipant(7, "REGISTERED");
    await expect(inscrire(sessionId, nonConfirme)).rejects.toThrowError(
      expect.objectContaining({ motif: "PARTICIPANT_NON_CONFIRME" }),
    );
  });

  it("refuse une seconde réservation sur la même session", async () => {
    const participantId = await creerParticipant(8);
    await inscrire(sessionId, participantId);
    await expect(inscrire(sessionId, participantId)).rejects.toThrowError(
      expect.objectContaining({ motif: "DEJA_INSCRIT" }),
    );
  });

  it("refuse deux sessions qui se chevauchent, y compris par englobement", async () => {
    const participantId = await creerParticipant(9);
    await inscrire(sessionId, participantId);

    // Session plus large, qui contient entièrement la première : c'est le cas
    // qu'une énumération naïve des recouvrements oublie.
    sessionParallele = (
      await creerSession({
        capacity: 50,
        startTime: new Date("2026-11-23T11:00:00.000Z"),
        endTime: new Date("2026-11-23T14:00:00.000Z"),
      })
    ).id;

    await expect(inscrire(sessionParallele, participantId)).rejects.toThrowError(
      expect.objectContaining({ motif: "CHEVAUCHEMENT" }),
    );
  });

  it("accepte deux sessions qui se suivent sans se recouvrir", async () => {
    const participantId = await creerParticipant(10);
    await inscrire(sessionId, participantId);

    const apres = await creerSession({
      capacity: 50,
      startTime: new Date("2026-11-23T13:00:00.000Z"),
      endTime: new Date("2026-11-23T14:30:00.000Z"),
    });
    expect(await inscrire(apres.id, participantId)).toEqual({ statut: "INSCRIT" });
  });

  it("refuse après l'échéance, mais laisse passer le personnel", async () => {
    const echue = await creerSession({
      registrationDeadline: new Date("2026-01-01T00:00:00.000Z"),
    });
    const participantId = await creerParticipant(11);

    await expect(inscrire(echue.id, participantId)).rejects.toThrowError(
      expect.objectContaining({ motif: "ECHEANCE_PASSEE" }),
    );
    // Le comité doit pouvoir placer quelqu'un à la main après la clôture.
    expect(await inscrire(echue.id, participantId, { parPersonnel: true })).toEqual({
      statut: "INSCRIT",
    });
  });

  it("réserve le quota VIP au placement manuel", async () => {
    // Capacité 2, quota 1 : une seule place en libre-service, la seconde
    // gardée pour le protocole.
    const avecQuota = await creerSession({ capacity: 2, vipQuota: 1, waitlistEnabled: false });
    expect(await inscrire(avecQuota.id, await creerParticipant(12))).toEqual({
      statut: "INSCRIT",
    });
    await expect(inscrire(avecQuota.id, await creerParticipant(13))).rejects.toThrowError(
      expect.objectContaining({ motif: "COMPLET" }),
    );
    expect(
      await inscrire(avecQuota.id, await creerParticipant(14), { parPersonnel: true }),
    ).toEqual({ statut: "INSCRIT" });
  });

  it("promeut le premier en liste d'attente à l'annulation", async () => {
    const premier = await creerParticipant(15);
    const second = await creerParticipant(16);
    const troisieme = await creerParticipant(17);

    await inscrire(sessionId, premier);
    await inscrire(sessionId, second);
    await inscrire(sessionId, troisieme);

    const resultat = await annuler(sessionId, premier);
    expect(resultat.promu?.participantId).toBe(second);

    const lignes = await listerInscriptions(sessionId);
    expect(lignes.find((l) => l.participantId === second)?.statut).toBe("REGISTERED");
    expect(lignes.find((l) => l.participantId === troisieme)?.statut).toBe("WAITLISTED");
  });

  it("ne promeut personne quand c'est un inscrit en attente qui se retire", async () => {
    const premier = await creerParticipant(18);
    const second = await creerParticipant(19);
    await inscrire(sessionId, premier);
    await inscrire(sessionId, second);

    // Le second était en attente : son retrait ne libère aucune place.
    expect((await annuler(sessionId, second)).promu).toBeNull();
  });

  it("permet de se réinscrire après annulation, sans créer de doublon", async () => {
    const participantId = await creerParticipant(20);
    await inscrire(sessionId, participantId);
    await annuler(sessionId, participantId);
    expect(await inscrire(sessionId, participantId)).toEqual({ statut: "INSCRIT" });

    const lignes = await prisma.sessionRegistration.count({
      where: { sessionId, participantId },
    });
    expect(lignes).toBe(1);
  });

  it("marque et démarque la présence", async () => {
    const participantId = await creerParticipant(21);
    await inscrire(sessionId, participantId);

    await marquerPresent(sessionId, participantId, true);
    expect((await listerInscriptions(sessionId))[0]!.statut).toBe("ATTENDED");

    await marquerPresent(sessionId, participantId, false);
    expect((await listerInscriptions(sessionId))[0]!.statut).toBe("REGISTERED");
  });

  /**
   * Le critère d'acceptation du brief §5.5.
   *
   * Sans le `SELECT … FOR UPDATE`, ce test produit plusieurs inscrits sur une
   * place unique : chaque requête lit un compteur d'avant les autres écritures.
   * C'est exactement le défaut qu'il existe pour attraper.
   */
  it("sur une place unique, vingt demandes simultanées donnent un inscrit et dix-neuf refus", async () => {
    const candidats = await Promise.all(
      Array.from({ length: 20 }, (_, index) => creerParticipant(100 + index)),
    );

    const issues = await Promise.allSettled(
      candidats.map((participantId) => inscrire(sessionId, participantId)),
    );

    const inscrits = issues.filter(
      (issue) => issue.status === "fulfilled" && issue.value.statut === "INSCRIT",
    );
    const attente = issues.filter(
      (issue) => issue.status === "fulfilled" && issue.value.statut === "LISTE_ATTENTE",
    );

    expect(inscrits).toHaveLength(1);
    expect(attente).toHaveLength(19);

    // Et la base dit la même chose que les valeurs renvoyées.
    const enBase = await prisma.sessionRegistration.count({
      where: { sessionId, status: "REGISTERED" },
    });
    expect(enBase).toBe(1);

    // Les positions d'attente sont uniques : deux fois « 3 » rendrait la
    // promotion arbitraire le jour où une place se libère.
    const positions = (
      await prisma.sessionRegistration.findMany({
        where: { sessionId, status: "WAITLISTED" },
        select: { waitlistPosition: true },
      })
    ).map((ligne) => ligne.waitlistPosition);
    expect(new Set(positions).size).toBe(19);
  }, 60_000);
});

describe("plafond de libre-service", () => {
  it("retire le quota VIP de la capacité", () => {
    expect(plafondLibreService(100, 20)).toBe(80);
  });

  it("traite l'absence de quota comme zéro", () => {
    expect(plafondLibreService(100, null)).toBe(100);
  });

  it("ne descend jamais sous zéro", () => {
    expect(plafondLibreService(10, 25)).toBe(0);
  });
});

describe("refus", () => {
  it("porte un motif exploitable par l'appelant", () => {
    const refus = new RefusInscription("COMPLET", "Complet.");
    expect(refus.motif).toBe("COMPLET");
    expect(refus).toBeInstanceOf(Error);
  });
});
