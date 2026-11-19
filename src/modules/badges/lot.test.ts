import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findMany,
  revokeBadge,
  prepareReissue,
  enqueueBadgeGeneration,
  enqueueBadgeGenerationMany,
  enqueueBadgeRefreshMany,
  enqueueBadgeReissueRender,
  log,
} = vi.hoisted(() => ({
  findMany: vi.fn(),
  revokeBadge: vi.fn(),
  prepareReissue: vi.fn(),
  enqueueBadgeGeneration: vi.fn(),
  enqueueBadgeGenerationMany: vi.fn(),
  enqueueBadgeRefreshMany: vi.fn(),
  enqueueBadgeReissueRender: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { participant: { findMany } } }));
vi.mock("@/modules/badges/service", () => ({ revokeBadge, prepareReissue }));
vi.mock("@/modules/badges/jobs", () => ({
  enqueueBadgeGenerationMany,
  enqueueBadgeRefreshMany,
  enqueueBadgeReissueRender,
}));
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
    enqueueBadgeRefreshMany.mockResolvedValue(undefined);
    enqueueBadgeGenerationMany.mockResolvedValue(undefined);
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
    enqueueBadgeRefreshMany.mockResolvedValue(undefined);
    enqueueBadgeGenerationMany.mockResolvedValue(undefined);
    findMany.mockResolvedValue([]);
  });

  /*
   * Une seule mise en file pour tout le lot, et non une par badge : c'est ce
   * qui fait tenir « Refaire 303 badges » dans le temps d'une requête
   * (19 novembre 2026).
   */
  it("génère les badges manquants par la file, en un seul appel groupé", async () => {
    findMany.mockResolvedValue([ligne("p1", null), ligne("p2", null)]);

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "manquants", acteur);

    expect(enqueueBadgeGenerationMany).toHaveBeenCalledTimes(1);
    expect(enqueueBadgeGenerationMany).toHaveBeenCalledWith(["p1", "p2"]);
    expect(enqueueBadgeRefreshMany).toHaveBeenCalledWith([], expect.anything());
    expect(resultat.traites).toBe(2);
  });

  it("refait les badges déjà émis sans e-mail, à version constante et d'un bloc", async () => {
    findMany.mockResolvedValue([ligne("p1"), ligne("p2")]);

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "existants", acteur);

    expect(enqueueBadgeRefreshMany).toHaveBeenCalledTimes(1);
    expect(enqueueBadgeRefreshMany).toHaveBeenCalledWith(["p1", "p2"], { silencieux: true });
    expect(enqueueBadgeGenerationMany).toHaveBeenCalledWith([]);
    expect(resultat.traites).toBe(2);
  });

  it("remonte une file indisponible plutôt que d'annoncer un lot parti", async () => {
    // Sans cela, l'écran annoncerait « 303 badges mis en file » sur une file
    // muette, et personne ne chercherait les badges avant le jour J.
    findMany.mockResolvedValue([ligne("p1")]);
    enqueueBadgeRefreshMany.mockRejectedValue(new Error("Redis injoignable"));

    await expect(mettreEnFileEnLot("e1", FILTRE, "existants", acteur)).rejects.toThrow(
      /1 badge\(s\).*Redis injoignable/,
    );
  });

  it("renvoie vers la réémission pour un badge révoqué, au lieu de le régénérer", async () => {
    findMany.mockResolvedValue([
      ligne("p1", { id: "b-p1", generatedAt: new Date(), revokedAt: new Date() }),
    ]);

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "manquants", acteur);

    expect(enqueueBadgeGeneration).not.toHaveBeenCalled();
    expect(resultat).toMatchObject({
      traites: 0,
      ignores: [{ nom: "NDIAYE Awa", raison: "badge révoqué : passez par la réémission" }],
    });
  });

  /*
   * Le cas qui laissait une impasse : six badges révoqués d'un coup, et plus
   * aucun bouton qui puisse rendre un badge valide à ces personnes.
   */
  it("réémet un badge révoqué en version suivante, et met son rendu en file", async () => {
    findMany.mockResolvedValue([
      ligne("p1", { id: "b-p1", generatedAt: new Date(), revokedAt: new Date() }),
    ]);
    prepareReissue.mockResolvedValue({ id: "b-p1-v2", version: 2 });

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "reemission", acteur);

    // Pas de motif : il n'y a plus rien à révoquer, on émet la suite.
    expect(prepareReissue).toHaveBeenCalledWith("p1", "", acteur);
    expect(enqueueBadgeReissueRender).toHaveBeenCalledWith("p1", 2);
    expect(resultat.traites).toBe(1);
  });

  it("ne réémet pas un badge encore valide", async () => {
    findMany.mockResolvedValue([ligne("p1")]);

    const resultat = await mettreEnFileEnLot("e1", FILTRE, "reemission", acteur);

    expect(prepareReissue).not.toHaveBeenCalled();
    expect(resultat).toMatchObject({
      traites: 0,
      ignores: [{ nom: "NDIAYE Awa", raison: "a déjà un badge valide : rien à réémettre" }],
    });
  });

  it("signale le badge disparu entre la liste et le clic", async () => {
    // Le badge existe mais n'a jamais été rendu : rien à refaire. L'état vient
    // de la requête de périmètre, et non plus d'une seconde lecture par cible.
    findMany.mockResolvedValue([ligne("p1", { id: "b-p1", generatedAt: null, revokedAt: null })]);

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
