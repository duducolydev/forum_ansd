import type { ParticipantStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { accesEspace, lireMotifRefus, TEXTES_REFUS } from "./acces-espace";

/**
 * Qui ouvre « Mon espace » (16 novembre 2026).
 *
 * Le défaut corrigé : un dossier non validé recevait un lien de connexion,
 * puis se heurtait à « lien invalide ou expiré ». La règle est désormais
 * unique, et ces tests la tiennent — c'est le genre de décision qu'une
 * correction ultérieure relâche sans s'en apercevoir.
 */

function participant(status: ParticipantStatus, presse = false) {
  return { status, category: { requiresAccreditation: presse } };
}

describe("accesEspace", () => {
  it("ouvre l'espace à un dossier validé", () => {
    for (const statut of ["CONFIRMED", "BADGED", "CHECKED_IN"] as const) {
      expect(accesEspace(participant(statut))).toEqual({ autorise: true });
    }
  });

  it("ferme l'espace à une inscription qui attend le comité", () => {
    // Le cas du signalement : la personne recevait un lien, et butait ensuite
    // sur un message d'expiration qui ne disait rien de la vraie raison.
    expect(accesEspace(participant("REGISTERED"))).toEqual({
      autorise: false,
      motif: "EN_ATTENTE_VALIDATION",
    });
  });

  it("laisse entrer la presse en attente d'accréditation", () => {
    // Son espace ne montre que l'état de sa demande (29 septembre 2026) :
    // fermer la porte ici supprimerait un écran voulu.
    expect(accesEspace(participant("REGISTERED", true))).toEqual({ autorise: true });
  });

  it("distingue une inscription jamais terminée d'une inscription en attente", () => {
    for (const statut of ["INVITED", "INVITATION_SENT", "REGISTRATION_STARTED"] as const) {
      expect(accesEspace(participant(statut))).toEqual({
        autorise: false,
        motif: "INSCRIPTION_INCOMPLETE",
      });
    }
  });

  it("ferme un dossier décliné ou annulé, et le dit autrement", () => {
    for (const statut of ["DECLINED", "CANCELLED"] as const) {
      expect(accesEspace(participant(statut))).toEqual({
        autorise: false,
        motif: "INSCRIPTION_CLOSE",
      });
    }
  });

  it("ferme la porte à la presse déclinée, accréditation ou non", () => {
    expect(accesEspace(participant("CANCELLED", true))).toEqual({
      autorise: false,
      motif: "INSCRIPTION_CLOSE",
    });
  });
});

describe("textes de refus", () => {
  it("existent dans les trois langues pour chaque motif", () => {
    for (const texte of Object.values(TEXTES_REFUS)) {
      for (const langue of ["fr", "en", "pt"] as const) {
        expect(texte.titre[langue].trim()).not.toBe("");
        expect(texte.message[langue].trim()).not.toBe("");
      }
    }
  });

  it("annoncent la suite et non seulement le refus", () => {
    // Un refus qui n'annonce pas ce qui se passera ensuite envoie la personne
    // écrire au comité — ce que le message est là pour éviter.
    expect(TEXTES_REFUS.EN_ATTENTE_VALIDATION.message.fr).toContain("e-mail");
    expect(TEXTES_REFUS.EN_ATTENTE_VALIDATION.message.en).toContain("email");
  });
});

describe("lireMotifRefus", () => {
  it("accepte un motif connu et rejette le reste", () => {
    // Le motif transite par l'URL : il est relu, jamais cru sur parole.
    expect(lireMotifRefus("EN_ATTENTE_VALIDATION")).toBe("EN_ATTENTE_VALIDATION");
    expect(lireMotifRefus("toString")).toBeNull();
    expect(lireMotifRefus("n'importe quoi")).toBeNull();
    expect(lireMotifRefus(undefined)).toBeNull();
  });
});
