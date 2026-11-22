import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { listParticipants, SANS_JOUR } from "./repository";

/**
 * Filtre « journée déclarée » (22 novembre 2026).
 *
 * Il se traduit en `JSON_CONTAINS` côté MySQL, et c'est tout l'intérêt du test :
 * le typage de Prisma accepte `array_contains` sur toutes les bases, l'exécution
 * non. Ce test touche donc une vraie base, contrairement au calcul d'affluence,
 * qui est pur.
 */

let editionId = "";
let categoryId = "";
const emails: string[] = [];

async function creer(participationDays: unknown, nom = "Filtre"): Promise<string> {
  const email = `jour-${randomUUID()}@example.test`;
  emails.push(email);
  const participant = await prisma.participant.create({
    data: {
      editionId,
      categoryId,
      publicId: `FJ-${randomUUID().slice(0, 8).toUpperCase()}`,
      firstName: nom,
      lastName: "Journée",
      email,
      country: "Sénégal",
      status: "CONFIRMED",
      participationDays: participationDays as never,
    },
  });
  return participant.id;
}

describe("filtre par journée déclarée", () => {
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
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it("retrouve ceux qui ont coché une journée, et eux seuls", async () => {
    const vingtTrois = await creer(["2026-11-23", "2026-11-25"]);
    const vingtQuatre = await creer(["2026-11-24"]);

    const { items } = await listParticipants({
      editionId,
      jour: "2026-11-23",
      page: 1,
      pageSize: 200,
    });
    const ids = items.map((item) => item.id);

    expect(ids).toContain(vingtTrois);
    expect(ids).not.toContain(vingtQuatre);
  });

  /*
   * Trois formes de « rien » en base : NULL, le littéral JSON null, et le
   * tableau vide. Les trois disent la même chose à qui lit l'écran.
   */
  it("retrouve les dossiers sans aucune journée, sous leurs trois formes", async () => {
    const sansRien = await creer(null);
    const tableauVide = await creer([]);
    const declare = await creer(["2026-11-24"]);

    const { items } = await listParticipants({
      editionId,
      jour: SANS_JOUR,
      page: 1,
      pageSize: 200,
    });
    const ids = items.map((item) => item.id);

    expect(ids).toContain(sansRien);
    expect(ids).toContain(tableauVide);
    expect(ids).not.toContain(declare);
  });

  /*
   * Les deux filtres rendent chacun un `OR`. Étalés dans le même objet, le
   * second écrasait le premier : la recherche l'emportait et la journée était
   * ignorée.
   */
  it("combine la recherche libre et le filtre de journée", async () => {
    const cherche = await creer(["2026-11-24"], "Zoubida");
    const memeNomAutreJour = await creer(["2026-11-23"], "Zoubida");

    const { items } = await listParticipants({
      editionId,
      q: "Zoubida",
      jour: "2026-11-24",
      page: 1,
      pageSize: 200,
    });
    const ids = items.map((item) => item.id);

    expect(ids).toContain(cherche);
    expect(ids).not.toContain(memeNomAutreJour);
  });
});
