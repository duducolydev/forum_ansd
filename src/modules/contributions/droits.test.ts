import { describe, expect, it } from "vitest";
import {
  niveauAcces,
  peutCreer,
  peutModifier,
  peutOrdonner,
  peutPublier,
  peutRattacher,
  type EtatContribution,
} from "./droits";

/**
 * La matrice des droits, telle que décidée le 14 septembre : rapporteurs
 * rattachés à leurs sessions, dépôts des intervenants reliés aux contributions,
 * publication gardée par le gestionnaire programme.
 */

const GESTIONNAIRE = ["sessions.read", "contributions.write"];
const RAPPORTEUR = ["contributions.draft"];
const AUTRE = ["participants.read"];

const brouillonComite: EtatContribution = { isPublished: false, origine: "COMITE" };
const brouillonRapporteur: EtatContribution = { isPublished: false, origine: "RAPPORTEUR" };
const brouillonIntervenant: EtatContribution = { isPublished: false, origine: "INTERVENANT" };
const enLigne: EtatContribution = { isPublished: true, origine: "RAPPORTEUR" };

describe("niveau d'accès", () => {
  it("donne toutes les sessions au gestionnaire, rattaché ou non", () => {
    expect(niveauAcces(GESTIONNAIRE, false)).toBe("complet");
    expect(niveauAcces(GESTIONNAIRE, true)).toBe("complet");
  });

  it("ne donne au rapporteur que les sessions auxquelles il est rattaché", () => {
    expect(niveauAcces(RAPPORTEUR, true)).toBe("rapporteur");
    // Le cœur de la demande : un rapporteur n'est pas un gestionnaire au
    // périmètre réduit par politesse, il n'a **rien** hors de ses sessions.
    expect(niveauAcces(RAPPORTEUR, false)).toBe("aucun");
  });

  it("ne donne rien à un compte sans permission de contribution", () => {
    expect(niveauAcces(AUTRE, true)).toBe("aucun");
  });
});

describe("création", () => {
  it("est ouverte au gestionnaire et au rapporteur rattaché", () => {
    expect(peutCreer("complet").autorise).toBe(true);
    expect(peutCreer("rapporteur").autorise).toBe(true);
    expect(peutCreer("aucun").autorise).toBe(false);
  });
});

describe("modification", () => {
  it("laisse au gestionnaire toute contribution, en ligne ou non", () => {
    for (const etat of [brouillonComite, brouillonIntervenant, enLigne]) {
      expect(peutModifier("complet", etat).autorise).toBe(true);
    }
  });

  it("laisse au rapporteur ses brouillons et ceux du comité", () => {
    expect(peutModifier("rapporteur", brouillonRapporteur).autorise).toBe(true);
    expect(peutModifier("rapporteur", brouillonComite).autorise).toBe(true);
  });

  it("refuse au rapporteur ce qui est déjà en ligne", () => {
    const verdict = peutModifier("rapporteur", enLigne);
    expect(verdict.autorise).toBe(false);
    expect(verdict.raison).toMatch(/en ligne/);
  });

  it("refuse au rapporteur la présentation déposée par un intervenant", () => {
    // Ce support appartient à son auteur : le rapporteur n'a pas à le retoucher.
    expect(peutModifier("rapporteur", brouillonIntervenant).autorise).toBe(false);
  });
});

describe("publication", () => {
  it("n'appartient qu'au gestionnaire", () => {
    const verdict = peutPublier("rapporteur", brouillonRapporteur, true);
    expect(verdict.autorise).toBe(false);
    expect(verdict.raison).toMatch(/gestionnaire/);
  });

  it("exige l'accord de l'intervenant pour sa présentation", () => {
    const sansAccord = peutPublier("complet", brouillonIntervenant, false);
    expect(sansAccord.autorise).toBe(false);
    expect(sansAccord.raison).toMatch(/autorisé/);

    expect(peutPublier("complet", brouillonIntervenant, true).autorise).toBe(true);
  });

  it("n'exige pas d'accord pour ce que le comité ou un rapporteur a rédigé", () => {
    // Le consentement porte sur l'œuvre d'un auteur extérieur, pas sur les
    // synthèses produites par l'organisation elle-même.
    expect(peutPublier("complet", brouillonComite, false).autorise).toBe(true);
    expect(peutPublier("complet", brouillonRapporteur, false).autorise).toBe(true);
  });
});

describe("rattachement des rapporteurs", () => {
  it("est réservé au gestionnaire", () => {
    expect(peutRattacher("complet").autorise).toBe(true);
    expect(peutRattacher("rapporteur").autorise).toBe(false);
  });
});

describe("ordre des contributions", () => {
  it("est réservé au gestionnaire", () => {
    // Déplacer un brouillon l'échange avec sa voisine, peut-être en ligne : ce
    // serait retoucher la fiche publique sans relecture.
    expect(peutOrdonner("complet").autorise).toBe(true);
    expect(peutOrdonner("rapporteur").autorise).toBe(false);
    expect(peutOrdonner("aucun").autorise).toBe(false);
  });
});
