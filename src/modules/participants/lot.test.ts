import { beforeEach, describe, expect, it, vi } from "vitest";

const { confirmParticipant, declineParticipant, log } = vi.hoisted(() => ({
  confirmParticipant: vi.fn(),
  declineParticipant: vi.fn(),
  log: vi.fn(),
}));

vi.mock("./service", () => ({ confirmParticipant, declineParticipant }));
vi.mock("@/lib/audit", () => ({ audit: { log } }));

import { InvalidParticipantTransitionError } from "./errors";
import { traiterEnLot } from "./lot";

const acteur = { type: "USER" as const, userId: "u1" };

describe("traitement en lot des inscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passe chaque fiche par la fonction de la fiche, avec les droits de l'agent", async () => {
    const resultat = await traiterEnLot(["a", "b", "a"], "confirm", acteur, {
      peutAccrediter: false,
    });

    expect(confirmParticipant).toHaveBeenCalledTimes(2);
    expect(confirmParticipant).toHaveBeenCalledWith("a", acteur, { peutAccrediter: false });
    expect(declineParticipant).not.toHaveBeenCalled();
    expect(resultat).toEqual({ traites: 2, ignores: [] });
  });

  it("met de côté une fiche refusée sans arrêter le lot", async () => {
    declineParticipant
      .mockRejectedValueOnce(new InvalidParticipantTransitionError("CONFIRMED", "decline"))
      .mockRejectedValueOnce(new Error("Accréditation réservée."))
      .mockResolvedValueOnce({});

    const resultat = await traiterEnLot(["a", "b", "c"], "decline", acteur);

    expect(resultat.traites).toBe(1);
    expect(resultat.ignores).toEqual([
      { id: "a", raison: "n'est plus en attente de validation" },
      { id: "b", raison: "Accréditation réservée." },
    ]);
  });

  it("laisse une trace d'audit pour le geste", async () => {
    await traiterEnLot(["a"], "confirm", acteur);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "participant.bulk_confirm",
        actorUserId: "u1",
        after: { demandes: 1, traites: 1, ignores: [] },
      }),
    );
  });
});
