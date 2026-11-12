import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, revokeBadge, enqueueBadgeGeneration, enqueueBadgeRefresh, log } = vi.hoisted(
  () => ({
    findMany: vi.fn(),
    revokeBadge: vi.fn(),
    enqueueBadgeGeneration: vi.fn(),
    enqueueBadgeRefresh: vi.fn(),
    log: vi.fn(),
  }),
);

vi.mock("@/lib/db", () => ({ prisma: { participant: { findMany } } }));
vi.mock("@/modules/badges/service", () => ({ revokeBadge }));
vi.mock("@/modules/badges/jobs", () => ({ enqueueBadgeRefresh }));
vi.mock("@/modules/participants/service", () => ({ enqueueBadgeGeneration }));
vi.mock("@/lib/audit", () => ({ audit: { log } }));

import { mettreEnFileEnLot, revoquerEnLot, type PerimetreLot } from "./lot";

const acteur = { type: "USER" as const, userId: "u1" };
const FILTRE: PerimetreLot = { mode: "filtre", filtre: { delegationId: "d1" } };

/** Une ligne telle que la requête la renvoie : participant + dernier badge. */
function ligne(
  id: string,
  badge: { id: string; generatedAt: Date | null; revokedAt: Date | null } | null = {
    id: `b-${id}`,
    generatedAt: new Date(),
    revokedAt: null,
  },
) {
  return {
    id,
    firstName: "Awa",
    lastName: "ndiaye",
    badges: badge ? [{ version: 1, ...badge }] : [],
  };
}

/** Le `where` passé à Prisma au dernier appel. */
function dernierWhere(): Record<string, unknown> {
  return findMany.mock.calls.at(-1)![0].where as Record<string, unknown>;
}

describe("périmètre d'un lot de badges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokeBadge.mockResolvedValue({});
    enqueueBadgeRefresh.mockResolvedValue(true);
    findMany.mockResolvedValue([]);
  });

  it("prend tout le filtre quand aucune ligne n'est cochée", async () => {
    await revoquerEnLot("e1", FILTRE, "Exclusion", acteur);

    const [base] = dernierWhere().AND as Record<string, unknown>[];
    expect(base).toMatchObject({ editionId: "e1", delegationId: "d1", deletedAt: null });
    expect(base).not.toHaveProperty("id");
  });

  it("se limite aux lignes cochées, sans doublon, et toujours dans l'édition", async () => {
    await revoquerEnLot(
      "e1",
      { mode: "selection", participantIds: ["p1", "p2", "p1"] },
      "Badge perdu",
      acteur,
    );

    const [base] = dernierWhere().AND as Record<string, unknown>[];
    expect(base).toMatchObject({ editionId: "e1", id: { in: ["p1", "p2"] } });
  });

  it("annonce ce qui dépasse le maximum d'un lot plutôt que de le traiter en silence", async () => {
    // 1 001 lignes : le plafond est de 1 000, la dernière sert de témoin.
    findMany.mockResolvedValue(Array.from({ length: 1001 }, (_, i) => ligne(`p${i}`)));

    const resultat = await revoquerEnLot("e1", FILTRE, "Exclusion", acteur);

    expect(resultat.traites).toBe(1000);
    expect(resultat.reste).toBe(1);
  });
});

describe("révocation de badges en lot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revokeBadge.mockResolvedValue({});
    findMany.mockResolvedValue([]);
  });

  it("passe chaque badge par la fonction de la fiche", async () => {
    findMany.mockResolvedValue([ligne("p1"), ligne("p2")]);

    const resultat = await revoquerEnLot("e1", FILTRE, "Badge perdu", acteur);

    expect(revokeBadge).toHaveBeenCalledTimes(2);
    expect(revokeBadge).toHaveBeenCalledWith("b-p1", "Badge perdu", acteur);
    expect(resultat).toMatchObject({ traites: 2, ignores: [], ignoresTotal: 0, reste: 0 });
  });

  it("met de côté un badge révoqué entre-temps ou en échec, sans arrêter le lot", async () => {
    findMany.mockResolvedValue([
      ligne("p1", { id: "b-p1", generatedAt: new Date(), revokedAt: new Date() }),
      ligne("p2"),
      ligne("p3"),
    ]);
    revokeBadge.mockRejectedValueOnce(new Error("Fichier introuvable.")).mockResolvedValueOnce({});

    const resultat = await revoquerEnLot("e1", FILTRE, "Erreur de saisie", acteur);

    expect(resultat.traites).toBe(1);
    expect(resultat.ignores).toEqual([
      { nom: "NDIAYE Awa", raison: "n'a plus de badge valide" },
      { nom: "NDIAYE Awa", raison: "Fichier introuvable." },
    ]);
  });

  it("laisse une trace d'audit pour le geste", async () => {
    findMany.mockResolvedValue([ligne("p1")]);

    await revoquerEnLot("e1", FILTRE, "Badge perdu", acteur);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "badge.bulk_revoke",
        actorUserId: "u1",
        after: expect.objectContaining({
          perimetre: "filtre",
          revoques: 1,
          motif: "Badge perdu",
        }),
      }),
    );
  });
});

describe("mise en file de la génération en lot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enqueueBadgeRefresh.mockResolvedValue(true);
    findMany.mockResolvedValue([]);
  });

  it("génère les badges manquants par la file, jamais dans la requête", async () => {
    findMany.mockResolvedValue([ligne("p1", null), ligne("p2", null)]);

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "manquants", acteur);

    expect(enqueueBadgeGeneration).toHaveBeenCalledTimes(2);
    expect(enqueueBadgeGeneration).toHaveBeenCalledWith("p1");
    expect(enqueueBadgeRefresh).not.toHaveBeenCalled();
    expect(resultat.traites).toBe(2);
  });

  it("refait les badges déjà émis sans e-mail, à version constante", async () => {
    findMany.mockResolvedValue([ligne("p1")]);

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "existants", acteur);

    expect(enqueueBadgeRefresh).toHaveBeenCalledWith("p1", { silencieux: true });
    expect(enqueueBadgeGeneration).not.toHaveBeenCalled();
    expect(resultat.traites).toBe(1);
  });

  it("renvoie vers la réémission pour un badge révoqué, au lieu de le régénérer", async () => {
    findMany.mockResolvedValue([
      ligne("p1", { id: "b-p1", generatedAt: new Date(), revokedAt: new Date() }),
    ]);

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "manquants", acteur);

    expect(enqueueBadgeGeneration).not.toHaveBeenCalled();
    expect(resultat).toMatchObject({
      traites: 0,
      ignores: [{ nom: "NDIAYE Awa", raison: "badge révoqué : à réémettre depuis la fiche" }],
    });
  });

  it("signale le badge disparu entre la liste et le clic", async () => {
    findMany.mockResolvedValue([ligne("p1")]);
    enqueueBadgeRefresh.mockResolvedValue(false);

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "ancien-gabarit", acteur);

    expect(resultat).toMatchObject({
      traites: 0,
      ignores: [{ nom: "NDIAYE Awa", raison: "plus de badge valide à refaire" }],
    });
  });

  it("journalise le passage au gabarit en vigueur sous sa propre action", async () => {
    findMany.mockResolvedValue([ligne("p1")]);

    await mettreEnFileEnLot(
      "e1",
      { mode: "selection", participantIds: ["p1"] },
      "ancien-gabarit",
      acteur,
    );

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "badge.bulk_reformat",
        after: expect.objectContaining({ perimetre: "selection", misEnFile: 1 }),
      }),
    );
  });
});
