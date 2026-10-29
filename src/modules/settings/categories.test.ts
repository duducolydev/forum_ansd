import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Le rafraîchissement des badges est observé, pas exécuté : on vérifie qui le
// déclenche, et avec ou sans e-mail.
const rafraichis = vi.hoisted(() => [] as { participantId: string; silencieux: boolean }[]);
vi.mock("@/modules/badges/jobs", async (original) => ({
  ...(await original<typeof import("@/modules/badges/jobs")>()),
  enqueueBadgeRefresh: vi.fn(
    async (participantId: string, options: { silencieux?: boolean } = {}) => {
      rafraichis.push({ participantId, silencieux: options.silencieux ?? false });
      return true;
    },
  ),
}));

import { prisma } from "@/lib/db";
import { updateParticipantDetails } from "@/modules/participants/service";
import type { ParticipantInput } from "@/modules/participants/schema";
import { codeDeCategorie } from "./regles";
import type { NouvelleCategorieInput } from "./schema";
import { creerCategorie, enregistrerCategorie } from "./service";

const suffixe = crypto.randomUUID().slice(0, 8);
const categoriesCreees: string[] = [];
let editionId: string;
let acteur: { userId: string };
let personnel: { id: string; categoryZones: { zoneId: string }[] };
let participantId: string;

function nouvelle(valeurs: Partial<NouvelleCategorieInput> = {}): NouvelleCategorieInput {
  return {
    labelFr: `Comité d'organisation ${suffixe}`,
    labelEn: "Organising committee",
    labelPt: "",
    color: "#6d4c9f",
    sortOrder: 0,
    isActive: true,
    isPublic: false,
    autoConfirm: true,
    requiresLogistics: false,
    alertOnScan: false,
    requiresAccreditation: false,
    badgeMention: "COMITÉ D'ORGANISATION",
    code: "",
    zonesDepuis: "TOUTES",
    ...valeurs,
  };
}

beforeAll(async () => {
  editionId = (await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } })).id;
  personnel = await prisma.participantCategory.findFirstOrThrow({
    where: { editionId, code: "PERSONNEL_ANSD" },
    select: { id: true, categoryZones: { select: { zoneId: true } } },
  });
  // L'audit exige un compte réel.
  const role = await prisma.role.findFirstOrThrow();
  const compte = await prisma.user.create({
    data: {
      email: `categories-${suffixe}@example.test`,
      name: "Test catégories",
      passwordHash: "x",
      roleId: role.id,
    },
  });
  acteur = { userId: compte.id };

  const participant = await prisma.participant.create({
    data: {
      editionId,
      publicId: `FID26-T${suffixe.slice(0, 5).toUpperCase()}`,
      firstName: "Membre",
      lastName: `Comité${suffixe}`,
      email: `categories-${suffixe}@example.test`,
      country: "Sénégal",
      categoryId: personnel.id,
      status: "BADGED",
      badges: {
        create: { version: 1, qrToken: `qr-categories-${suffixe}`, generatedAt: new Date() },
      },
    },
  });
  participantId = participant.id;
});

afterAll(async () => {
  await prisma.participant.deleteMany({ where: { id: participantId } });
  await prisma.participantCategory.deleteMany({ where: { id: { in: categoriesCreees } } });
  await prisma.user.deleteMany({ where: { id: acteur.userId } });
  await prisma.$disconnect();
});

describe("création d'une catégorie en BackOffice (24 octobre 2026)", () => {
  it("crée la catégorie, son code tiré du libellé, et copie les zones du modèle", async () => {
    const { categorie, zones } = await creerCategorie(
      editionId,
      nouvelle({ zonesDepuis: personnel.id }),
      acteur,
    );
    categoriesCreees.push(categorie.id);

    expect(categorie.code).toBe(codeDeCategorie(`Comité d'organisation ${suffixe}`));
    expect(categorie).toMatchObject({
      isPublic: false,
      isActive: true,
      badgeMention: "COMITÉ D'ORGANISATION",
      color: "#6d4c9f",
    });
    expect(zones).toBe(personnel.categoryZones.length);
    const ouvertes = await prisma.categoryZone.findMany({
      where: { categoryId: categorie.id },
      select: { zoneId: true },
    });
    expect(ouvertes.map((z) => z.zoneId).sort()).toEqual(
      personnel.categoryZones.map((z) => z.zoneId).sort(),
    );

    // Placée en fin de liste.
    const max = await prisma.participantCategory.aggregate({
      where: { editionId, id: { not: categorie.id } },
      _max: { sortOrder: true },
    });
    expect(categorie.sortOrder).toBeGreaterThan(max._max.sortOrder ?? 0);
  });

  it("ouvre toutes les zones sur demande", async () => {
    const { categorie, zones } = await creerCategorie(
      editionId,
      nouvelle({ code: `TOUTES_${suffixe.toUpperCase()}`, labelFr: `Toutes zones ${suffixe}` }),
      acteur,
    );
    categoriesCreees.push(categorie.id);
    expect(zones).toBe(await prisma.zone.count({ where: { editionId } }));
  });

  it("refuse un code déjà pris", async () => {
    await expect(
      creerCategorie(editionId, nouvelle({ code: "PERSONNEL_ANSD" }), acteur),
    ).rejects.toThrow(/déjà pris/);
  });
});

describe("badge tenu à jour de la catégorie", () => {
  async function saisie(categoryId: string): Promise<ParticipantInput> {
    return {
      firstName: "Membre",
      lastName: `Comité${suffixe}`,
      email: `categories-${suffixe}@example.test`,
      country: "Sénégal",
      categoryId,
      locale: "fr",
      attendsOpening: false,
      attendsInaugural: false,
      attendsClosing: false,
      attendsAwards: false,
      needsAccommodation: false,
      needsTransport: false,
    };
  }

  it("refait le badge, avec e-mail, quand le participant change de catégorie", async () => {
    const comite = categoriesCreees[0]!;
    rafraichis.length = 0;

    await updateParticipantDetails(participantId, await saisie(comite), { type: "SYSTEM" });
    expect(rafraichis).toEqual([{ participantId, silencieux: false }]);

    // Même catégorie : rien à refaire.
    await updateParticipantDetails(participantId, await saisie(comite), { type: "SYSTEM" });
    expect(rafraichis).toHaveLength(1);
  });

  it("refait le badge, sans e-mail, quand un texte imprimé est corrigé", async () => {
    const comite = categoriesCreees[0]!;
    rafraichis.length = 0;

    const corrigee = { ...(await saisie(comite)), organization: "ANSD" };
    await updateParticipantDetails(participantId, corrigee, { type: "SYSTEM" });
    expect(rafraichis).toEqual([{ participantId, silencieux: true }]);
  });

  it("refait sans e-mail les badges d'une catégorie dont la couleur change", async () => {
    const comite = await prisma.participantCategory.findUniqueOrThrow({
      where: { id: categoriesCreees[0]! },
    });
    const valeurs = {
      labelFr: comite.labelFr,
      labelEn: comite.labelEn,
      labelPt: "",
      color: comite.color ?? "",
      sortOrder: comite.sortOrder,
      isActive: true,
      autoConfirm: true,
      requiresLogistics: false,
      alertOnScan: false,
      requiresAccreditation: false,
      isPublic: false,
      badgeMention: comite.badgeMention ?? "",
    };
    rafraichis.length = 0;

    // Une règle change, pas l'apparence : aucun badge refait.
    const sansApparence = await enregistrerCategorie(
      editionId,
      comite.id,
      { ...valeurs, alertOnScan: true },
      acteur,
    );
    expect(sansApparence.badgesRafraichis).toBe(0);

    const { badgesRafraichis } = await enregistrerCategorie(
      editionId,
      comite.id,
      { ...valeurs, color: "#c8323a" },
      acteur,
    );
    expect(badgesRafraichis).toBe(1);
    expect(rafraichis).toEqual([{ participantId, silencieux: true }]);
  });
});
