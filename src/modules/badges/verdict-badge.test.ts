import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));

import { verdictDuBadge } from "./public-verify";

/**
 * Le verdict rendu à un agent de contrôle. C'est la fonction qui décide si
 * quelqu'un entre : chaque cas est ici, y compris ceux qu'on espère ne jamais
 * voir.
 */

type BadgeArg = Parameters<typeof verdictDuBadge>[0];

function badgeNominatif(surcharge: Record<string, unknown> = {}): BadgeArg {
  return {
    version: 2,
    revokedAt: null,
    revokeReason: null,
    anonymousRef: null,
    anonymousSeq: null,
    anonymousCategory: null,
    participant: {
      civility: "Mme",
      firstName: "Aminata",
      lastName: "Sow",
      organization: "ANSD",
      country: "Sénégal",
      publicId: "FID26-ABC",
      status: "BADGED",
      deletedAt: null,
      category: { labelFr: "Délégué" },
    },
    ...surcharge,
  } as unknown as BadgeArg;
}

function carteAnonyme(surcharge: Record<string, unknown> = {}): BadgeArg {
  return {
    version: 1,
    revokedAt: null,
    revokeReason: null,
    anonymousRef: "FID26-ANON-014",
    anonymousSeq: 14,
    anonymousCategory: { labelFr: "Protocole" },
    participant: null,
    ...surcharge,
  } as unknown as BadgeArg;
}

describe("badge nominatif", () => {
  it("annonce le porteur quand tout est en ordre", () => {
    const verdict = verdictDuBadge(badgeNominatif(), "SIGNED");

    expect(verdict).toMatchObject({
      status: "VALID",
      assurance: "SIGNED",
      participant: { lastName: "Sow", categoryLabel: "Délégué" },
    });
  });

  it("annonce une participation annulée plutôt que « valide »", () => {
    const verdict = verdictDuBadge(
      badgeNominatif({
        participant: { ...badgeNominatif().participant, status: "CANCELLED" },
      }),
      "SIGNED",
    );

    expect(verdict.status).toBe("CANCELLED");
  });

  it("ne dit rien d'une fiche supprimée", () => {
    const verdict = verdictDuBadge(
      badgeNominatif({
        participant: { ...badgeNominatif().participant, deletedAt: new Date() },
      }),
      "SIGNED",
    );

    expect(verdict.status).toBe("UNKNOWN");
  });
});

/**
 * Les cartes anonymes : valides, mais muettes sur qui les porte. Le verdict
 * doit le dire, et non laisser l'agent devant un cadre vide.
 */
describe("carte anonyme", () => {
  it("se distingue d'un badge nominatif valide", () => {
    const verdict = verdictDuBadge(carteAnonyme(), "SIGNED");

    expect(verdict).toMatchObject({
      status: "VALID_ANONYME",
      categoryLabel: "Protocole",
      numero: 14,
      reference: "FID26-ANON-014",
    });
  });

  it("s'annonce révoquée comme les autres", () => {
    // L'ordre des contrôles compte : révocation d'abord, porteur ensuite.
    const verdict = verdictDuBadge(
      carteAnonyme({ revokedAt: new Date(), revokeReason: "Carte perdue" }),
      "SIGNED",
    );

    expect(verdict).toMatchObject({ status: "REVOKED", reason: "Carte perdue" });
  });

  it("reste inconnue si sa catégorie a disparu", () => {
    // Une carte sans porteur ni catégorie ne décrit plus rien : mieux vaut un
    // refus qu'un « valide » sans objet.
    expect(verdictDuBadge(carteAnonyme({ anonymousCategory: null }), "SIGNED").status).toBe(
      "UNKNOWN",
    );
    expect(verdictDuBadge(carteAnonyme({ anonymousRef: null }), "SIGNED").status).toBe("UNKNOWN");
  });

  it("transmet le niveau de preuve, identifiant saisi compris", () => {
    const verdict = verdictDuBadge(carteAnonyme(), "IDENTIFIER");

    expect(verdict).toMatchObject({ status: "VALID_ANONYME", assurance: "IDENTIFIER" });
  });
});
