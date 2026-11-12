import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, revokeBadge, log } = vi.hoisted(() => ({
  findMany: vi.fn(),
  revokeBadge: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { badge: { findMany } } }));
vi.mock("@/modules/badges/service", () => ({ revokeBadge }));
vi.mock("@/lib/audit", () => ({ audit: { log } }));

import { revoquerEnLot } from "./lot";

const acteur = { type: "USER" as const, userId: "u1" };

function badge(id: string, revoke: Date | null = null) {
  return {
    id,
    version: 1,
    revokedAt: revoke,
    participant: { firstName: "Awa", lastName: "ndiaye" },
  };
}

describe("révocation de badges en lot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokeBadge.mockResolvedValue({});
  });

  it("passe chaque badge par la fonction de la fiche, sans doublon", async () => {
    findMany.mockResolvedValue([badge("b1"), badge("b2")]);

    const resultat = await revoquerEnLot("e1", ["b1", "b2", "b1"], "Badge perdu", acteur);

    expect(revokeBadge).toHaveBeenCalledTimes(2);
    expect(revokeBadge).toHaveBeenCalledWith("b1", "Badge perdu", acteur);
    expect(resultat).toEqual({ revoques: 2, ignores: [] });
  });

  it("ne révoque que les badges de l'édition en cours", async () => {
    findMany.mockResolvedValue([badge("b1")]);

    const resultat = await revoquerEnLot("e1", ["b1", "autre-edition"], "Exclusion", acteur);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ participant: { editionId: "e1" } }),
      }),
    );
    expect(revokeBadge).toHaveBeenCalledTimes(1);
    expect(resultat.revoques).toBe(1);
    expect(resultat.ignores).toEqual([
      {
        badgeId: "autre-edition",
        nom: "autre-edition",
        raison: "badge introuvable dans cette édition",
      },
    ]);
  });

  it("met de côté un badge déjà révoqué ou en échec sans arrêter le lot", async () => {
    findMany.mockResolvedValue([badge("b1", new Date()), badge("b2"), badge("b3")]);
    revokeBadge.mockRejectedValueOnce(new Error("Fichier introuvable.")).mockResolvedValueOnce({});

    const resultat = await revoquerEnLot("e1", ["b1", "b2", "b3"], "Erreur de saisie", acteur);

    expect(resultat.revoques).toBe(1);
    expect(resultat.ignores).toEqual([
      { badgeId: "b1", nom: "NDIAYE Awa (v1)", raison: "était déjà révoqué" },
      { badgeId: "b2", nom: "NDIAYE Awa (v1)", raison: "Fichier introuvable." },
    ]);
  });

  it("laisse une trace d'audit pour le geste", async () => {
    findMany.mockResolvedValue([badge("b1")]);

    await revoquerEnLot("e1", ["b1"], "Badge perdu", acteur);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "badge.bulk_revoke",
        actorUserId: "u1",
        after: { demandes: 1, revoques: 1, ignores: [], motif: "Badge perdu" },
      }),
    );
  });
});
