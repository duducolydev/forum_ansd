import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { apercu, dateEnvoi, ECHEANCES, planifier } from "./reminders";

const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();
const emails: string[] = [];
let editionId = "";
let categoryId = "";
const participantIds: string[] = [];

/** Loin dans le futur : les échéances doivent être à venir pour être programmées. */
const DEBUT_FUTUR = new Date("2099-11-23T00:00:00.000Z");

async function creerParticipant(statut: "CONFIRMED" | "REGISTERED" | "DECLINED") {
  const email = `rappel-${randomUUID()}@example.test`;
  emails.push(email);
  const participant = await prisma.participant.create({
    data: {
      editionId,
      publicId: `RAP-${SUFFIXE}-${emails.length}`,
      firstName: "Aminata",
      lastName: `Rappel${SUFFIXE}`,
      email,
      country: "Sénégal",
      categoryId,
      status: statut,
      source: "ONSITE",
      confirmedAt: statut === "CONFIRMED" ? new Date() : null,
    },
  });
  participantIds.push(participant.id);
  return participant;
}

describe("rappels planifiés (brief §14)", () => {
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
    await prisma.notificationLog.deleteMany({ where: { participantId: { in: participantIds } } });
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  }, 30_000);

  describe("date d'envoi", () => {
    it("recule du bon nombre de jours et vise 9 h", () => {
      const envoi = dateEnvoi(new Date("2026-11-23T00:00:00.000Z"), 7);
      // Un rappel reçu à 3 h du matin ne sert personne.
      expect(envoi.toISOString()).toBe("2026-11-16T09:00:00.000Z");
    });

    it("gère le passage d'un mois à l'autre", () => {
      const envoi = dateEnvoi(new Date("2026-12-02T00:00:00.000Z"), 7);
      expect(envoi.toISOString()).toBe("2026-11-25T09:00:00.000Z");
    });

    it("couvre les deux échéances du brief", () => {
      expect(ECHEANCES.map((echeance) => echeance.joursAvant)).toEqual([7, 1]);
    });
  });

  describe("aperçu", () => {
    it("signale une échéance déjà passée", async () => {
      // L'édition 2026 est derrière nous dans le calendrier de la machine de
      // test : les deux échéances doivent être marquées dépassées.
      const plans = await apercu(editionId, new Date("2020-01-10T00:00:00.000Z"));
      expect(plans).toHaveLength(2);
      expect(plans.every((plan) => plan.depasse)).toBe(true);
    });

    it("ne compte que les participants qui viennent", async () => {
      await creerParticipant("CONFIRMED");
      await creerParticipant("DECLINED");
      const plans = await apercu(editionId, DEBUT_FUTUR);

      const declines = await prisma.participant.count({
        where: { editionId, status: "DECLINED", deletedAt: null },
      });
      expect(declines).toBeGreaterThan(0);
      // Les personnes ayant décliné ne figurent pas parmi les destinataires.
      const attendus = await prisma.participant.count({
        where: { editionId, deletedAt: null, status: { in: ["CONFIRMED", "BADGED"] } },
      });
      expect(plans[0]!.destinataires).toBe(attendus);
    });
  });

  describe("planification", () => {
    it("ne programme rien pour une échéance passée, et le dit", async () => {
      const resultat = await planifier(editionId, new Date("2020-01-10T00:00:00.000Z"), undefined);
      expect(resultat.programmes).toBe(0);
      expect(resultat.echeancesDepassees).toHaveLength(2);
    });

    /**
     * Le point qui compte : reprogrammer après avoir confirmé de nouvelles
     * personnes ne doit pas réécrire aux précédentes. La clé d'idempotence de la
     * file n'y suffit pas — BullMQ efface un job terminé — d'où le contrôle sur
     * `NotificationLog`.
     */
    it("écarte les participants ayant déjà reçu ce rappel", async () => {
      const participant = await creerParticipant("CONFIRMED");
      await prisma.notificationLog.create({
        data: {
          participantId: participant.id,
          templateKey: "reminder_j7",
          channel: "EMAIL",
          to: participant.email,
          status: "SENT",
        },
      });

      const resultat = await planifier(editionId, DEBUT_FUTUR, undefined);
      expect(resultat.ignores).toBeGreaterThanOrEqual(1);
    }, 60_000);
  });
});
