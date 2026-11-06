import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { HarmonisationError, harmoniserPays, inventairePays } from "./pays-service";

/** Harmonisation des pays déjà en base (Paramètres › Pays). */
describe("harmonisation des pays", () => {
  const suffixe = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  // Valeurs propres à ce test, pour ne rien toucher d'autre en base.
  const VARIANTE = `Sénégal-${suffixe}`;
  const VARIANTE_CASSE = `sénégal-${suffixe}`;
  const ids: { participants: string[]; speakerId: string; acteur: string } = {
    participants: [],
    speakerId: "",
    acteur: "",
  };

  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    const categorie = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId: edition.id, code: "PARTICIPANT_NATIONAL" },
    });
    ids.acteur = (await prisma.user.findFirstOrThrow({ select: { id: true } })).id;
    for (const [rang, country] of [VARIANTE, VARIANTE, VARIANTE_CASSE].entries()) {
      ids.participants.push(
        (
          await prisma.participant.create({
            data: {
              editionId: edition.id,
              publicId: `PAYS-${suffixe}-${rang}`,
              firstName: "Awa",
              lastName: `PAYS${suffixe}`,
              email: `pays-${rang}-${suffixe.toLowerCase()}@x.test`,
              country,
              categoryId: categorie.id,
            },
          })
        ).id,
      );
    }
    ids.speakerId = (
      await prisma.speaker.create({
        data: {
          editionId: edition.id,
          firstName: "Awa",
          lastName: `PAYS${suffixe}`,
          country: VARIANTE,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.speaker.deleteMany({ where: { id: ids.speakerId } });
    await prisma.participant.deleteMany({ where: { id: { in: ids.participants } } });
    await prisma.$disconnect();
  });

  it("distingue les variantes à l'octet près, que la base confondrait", async () => {
    const { aHarmoniser } = await inventairePays();
    const variante = aHarmoniser.find((ligne) => ligne.valeur === VARIANTE);
    const casse = aHarmoniser.find((ligne) => ligne.valeur === VARIANTE_CASSE);
    expect(variante).toMatchObject({
      total: 3,
      parTable: { participants: 2, intervenants: 1, invitations: 0, delegations: 0 },
      proposition: null,
    });
    expect(casse?.total).toBe(1);
  });

  it("remplace la seule variante choisie, dans toutes les tables", async () => {
    const resultat = await harmoniserPays([{ de: VARIANTE, vers: "Sénégal" }], {
      userId: ids.acteur,
    });
    expect(resultat).toEqual({ valeurs: 1, fiches: 3 });

    const participants = await prisma.participant.findMany({
      where: { id: { in: ids.participants } },
      orderBy: { publicId: "asc" },
      select: { country: true },
    });
    expect(participants.map((p) => p.country)).toEqual(["Sénégal", "Sénégal", VARIANTE_CASSE]);
    expect((await prisma.speaker.findUniqueOrThrow({ where: { id: ids.speakerId } })).country).toBe(
      "Sénégal",
    );
  });

  it("refuse une cible hors de la liste", async () => {
    await expect(
      harmoniserPays([{ de: VARIANTE_CASSE, vers: "Dakar" }], { userId: ids.acteur }),
    ).rejects.toBeInstanceOf(HarmonisationError);
  });
});
