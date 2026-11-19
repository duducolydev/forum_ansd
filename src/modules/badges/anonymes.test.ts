import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  editionFindUniqueOrThrow,
  categorieFindUniqueOrThrow,
  badgeCreateMany,
  badgeFindMany,
  badgeAggregate,
  log,
} = vi.hoisted(() => ({
  editionFindUniqueOrThrow: vi.fn(),
  categorieFindUniqueOrThrow: vi.fn(),
  badgeCreateMany: vi.fn(),
  badgeFindMany: vi.fn(),
  badgeAggregate: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    edition: { findUniqueOrThrow: editionFindUniqueOrThrow },
    participantCategory: { findUniqueOrThrow: categorieFindUniqueOrThrow },
    badge: { createMany: badgeCreateMany, findMany: badgeFindMany, aggregate: badgeAggregate },
  },
}));
vi.mock("@/lib/audit", () => ({ audit: { log } }));
vi.mock("@/lib/storage", () => ({ fileStorage: { get: vi.fn() } }));

import { creerBadgesAnonymes, referenceAnonyme } from "./anonymes";

const acteur = { type: "USER" as const, userId: "u1" };

beforeEach(() => {
  vi.clearAllMocks();
  editionFindUniqueOrThrow.mockResolvedValue({ code: "FID26" });
  categorieFindUniqueOrThrow.mockResolvedValue({
    id: "c1",
    editionId: "e1",
    labelFr: "Protocole",
  });
  badgeAggregate.mockResolvedValue({ _max: { anonymousSeq: null } });
  badgeCreateMany.mockResolvedValue({ count: 0 });
  // La relecture rend un identifiant par ligne écrite.
  badgeFindMany.mockImplementation((requete: { where: { anonymousRef: { in: string[] } } }) =>
    Promise.resolve(requete.where.anonymousRef.in.map((reference) => ({ id: `b-${reference}` }))),
  );
});

describe("référence imprimée", () => {
  it("se lit sans ambiguïté, numéro sur trois chiffres", () => {
    expect(referenceAnonyme("FID26", 1)).toBe("FID26-ANON-001");
    expect(referenceAnonyme("FID26", 42)).toBe("FID26-ANON-042");
  });

  it("ne tronque pas au-delà de mille", () => {
    expect(referenceAnonyme("FID26", 1234)).toBe("FID26-ANON-1234");
  });
});

/**
 * La numérotation est ce qui rend le registre de remise exploitable : en face
 * d'un numéro, un nom et une heure. Deux cartes portant le même numéro le
 * rendraient inutilisable, et c'est irrattrapable une fois les cartes
 * imprimées et distribuées.
 */
describe("numérotation du stock", () => {
  it("démarre à 1 pour une catégorie neuve", async () => {
    const { references } = await creerBadgesAnonymes("e1", "c1", 3, acteur);

    expect(references).toEqual(["FID26-ANON-001", "FID26-ANON-002", "FID26-ANON-003"]);
  });

  it("reprend après le dernier numéro émis", async () => {
    badgeAggregate.mockResolvedValue({ _max: { anonymousSeq: 17 } });

    const { references } = await creerBadgesAnonymes("e1", "c1", 2, acteur);

    expect(references).toEqual(["FID26-ANON-018", "FID26-ANON-019"]);
  });

  it("compte aussi les cartes révoquées, qui ne rendent pas leur numéro", async () => {
    await creerBadgesAnonymes("e1", "c1", 1, acteur);

    // Aucune condition sur `revokedAt` : un numéro retiré ne revient jamais.
    expect(badgeAggregate).toHaveBeenCalledWith({
      where: { anonymousCategoryId: "c1" },
      _max: { anonymousSeq: true },
    });
  });

  it("crée des cartes sans porteur, à la version 1", async () => {
    await creerBadgesAnonymes("e1", "c1", 1, acteur);

    const [ligne] = badgeCreateMany.mock.calls[0]![0].data as Record<string, unknown>[];
    expect(ligne).toMatchObject({ version: 1, anonymousRef: "FID26-ANON-001", anonymousSeq: 1 });
    expect(ligne).not.toHaveProperty("participantId");
    expect(ligne!.qrToken).toEqual(expect.any(String));
  });

  it("donne un QR distinct à chaque carte", async () => {
    await creerBadgesAnonymes("e1", "c1", 3, acteur);

    const lignes = badgeCreateMany.mock.calls[0]![0].data as { qrToken: string }[];
    expect(new Set(lignes.map((ligne) => ligne.qrToken)).size).toBe(3);
  });

  it("n'écrit qu'une fois, quel que soit le nombre de cartes", async () => {
    // Deux cents cartes ne doivent pas valoir deux cents allers-retours.
    await creerBadgesAnonymes("e1", "c1", 50, acteur);

    expect(badgeCreateMany).toHaveBeenCalledTimes(1);
    expect((badgeCreateMany.mock.calls[0]![0].data as unknown[]).length).toBe(50);
  });
});

describe("garde-fous", () => {
  it("refuse un nombre absurde plutôt que d'inonder la file", async () => {
    await expect(creerBadgesAnonymes("e1", "c1", 0, acteur)).rejects.toThrow(/entier positif/);
    await expect(creerBadgesAnonymes("e1", "c1", 2.5, acteur)).rejects.toThrow(/entier positif/);
    await expect(creerBadgesAnonymes("e1", "c1", 500, acteur)).rejects.toThrow(/200/);
    expect(badgeCreateMany).not.toHaveBeenCalled();
  });

  it("refuse une catégorie d'une autre édition", async () => {
    categorieFindUniqueOrThrow.mockResolvedValue({
      id: "c9",
      editionId: "AUTRE",
      labelFr: "Presse",
    });

    await expect(creerBadgesAnonymes("e1", "c9", 1, acteur)).rejects.toThrow(/édition active/);
    expect(badgeCreateMany).not.toHaveBeenCalled();
  });

  it("laisse une trace nommant les bornes du lot", async () => {
    await creerBadgesAnonymes("e1", "c1", 4, acteur);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "badge.anonymous_created",
        after: expect.objectContaining({
          categorie: "Protocole",
          nombre: 4,
          du: "FID26-ANON-001",
          au: "FID26-ANON-004",
        }),
      }),
    );
  });
});
