import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { listSpeakers, rechercheIntervenantsSchema } from "./service";

/** Recherche et pagination de la liste des intervenants du BackOffice. */
describe("recherche des intervenants", () => {
  const suffixe = randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  let editionId = "";
  let sessionId = "";
  let participantId = "";
  const speakerIds: string[] = [];

  const chercher = async (parametres: Record<string, string>) => {
    const { items, total } = await listSpeakers(
      editionId,
      rechercheIntervenantsSchema.parse(parametres),
    );
    return { noms: items.map((speaker) => speaker.lastName).sort(), total };
  };

  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    const categorie = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    });
    participantId = (
      await prisma.participant.create({
        data: {
          editionId,
          publicId: `RECH-${suffixe}`,
          firstName: "Mady",
          lastName: `Lie${suffixe}`,
          email: `lie-${suffixe.toLowerCase()}@example.test`,
          country: "Libéria",
          categoryId: categorie.id,
        },
      })
    ).id;
    sessionId = (
      await prisma.session.create({
        data: {
          editionId,
          slug: `recherche-${suffixe.toLowerCase()}`,
          type: "PANEL",
          titleFr: `Panel ${suffixe} - Le pari démographique`,
          titleEn: "Search panel",
          day: new Date("2026-11-24T00:00:00.000Z"),
          startTime: new Date("2026-11-24T09:00:00.000Z"),
          endTime: new Date("2026-11-24T10:00:00.000Z"),
        },
      })
    ).id;

    const fiches = [
      { firstName: "Samuel", lastName: `Annim${suffixe}`, isPublished: true },
      {
        firstName: "Awa",
        lastName: `Bree${suffixe}`,
        email: `awa-${suffixe.toLowerCase()}@x.test`,
      },
      { firstName: "Mady", lastName: `Lie${suffixe}`, participantId, isPublished: true },
    ];
    for (const fiche of fiches) {
      speakerIds.push((await prisma.speaker.create({ data: { editionId, ...fiche } })).id);
    }
    await prisma.sessionSpeaker.create({
      data: { sessionId, speakerId: speakerIds[1]!, role: "PANELIST" },
    });
  });

  afterAll(async () => {
    await prisma.speaker.deleteMany({ where: { id: { in: speakerIds } } });
    await prisma.session.deleteMany({ where: { id: sessionId } });
    await prisma.participant.deleteMany({ where: { id: participantId } });
    await prisma.$disconnect();
  });

  it("trouve un nom complet tapé dans un sens ou dans l'autre", async () => {
    expect((await chercher({ q: `samuel annim${suffixe}` })).noms).toEqual([`Annim${suffixe}`]);
    expect((await chercher({ q: `annim${suffixe} SAMUEL` })).noms).toEqual([`Annim${suffixe}`]);
  });

  it("cherche dans l'adresse de la fiche comme dans celle du participant lié", async () => {
    expect((await chercher({ q: `awa-${suffixe}` })).noms).toEqual([`Bree${suffixe}`]);
    expect((await chercher({ q: `lie-${suffixe}@` })).noms).toEqual([`Lie${suffixe}`]);
  });

  it("trouve les intervenants d'un panel par son titre, ou par la liste des sessions", async () => {
    expect((await chercher({ q: `Panel ${suffixe}` })).noms).toEqual([`Bree${suffixe}`]);
    expect((await chercher({ q: suffixe, sessionId })).noms).toEqual([`Bree${suffixe}`]);
  });

  it("sépare fiches publiées et brouillons", async () => {
    expect((await chercher({ q: suffixe, publication: "brouillons" })).noms).toEqual([
      `Bree${suffixe}`,
    ]);
    expect((await chercher({ q: suffixe, publication: "publies" })).total).toBe(2);
  });

  it("pagine sans perdre le total", async () => {
    const premiere = await chercher({ q: suffixe, pageSize: "2" });
    const seconde = await chercher({ q: suffixe, pageSize: "2", page: "2" });
    expect(premiere.total).toBe(3);
    expect(premiere.noms).toHaveLength(2);
    expect(seconde.noms).toHaveLength(1);
  });
});
