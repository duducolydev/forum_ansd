import { describe, expect, it } from "vitest";
import {
  formaterMesPanels,
  formaterProgramme,
  variablesProgrammeUtilisees,
  type ReservationRecap,
  type SessionRecap,
} from "./recap-programme";

/**
 * Récapitulatif du programme dans les courriels (13 novembre 2026).
 *
 * Les fonctions de mise en forme sont pures : ce fichier les vérifie sans base
 * ni envoi. Ce qui compte ici est la lisibilité d'un texte que personne ne
 * relira avant qu'il parte à cent quarante personnes.
 */

function session(partiel: Partial<SessionRecap> = {}): SessionRecap {
  return {
    number: null,
    type: "PANEL",
    titleFr: "Données et climat",
    titleEn: "Data and climate",
    titlePt: null,
    day: new Date("2026-11-24T00:00:00.000Z"),
    startTime: new Date("2026-11-24T09:00:00.000Z"),
    endTime: new Date("2026-11-24T10:30:00.000Z"),
    room: { name: "Salle A" },
    speakers: [],
    ...partiel,
  };
}

describe("formaterProgramme", () => {
  it("annonce la publication à venir plutôt qu'un vide", () => {
    // Un courriel qui laisse un trou là où le programme devait figurer se lit
    // comme un défaut d'envoi.
    expect(formaterProgramme([], "fr")).toContain("sera publié prochainement");
    expect(formaterProgramme([], "en")).toContain("will be published shortly");
  });

  it("groupe par journée et donne créneau, nature et salle", () => {
    const texte = formaterProgramme([session()], "fr");
    const lignes = texte.split("\n");

    expect(lignes[0]).toBe("Mardi 24 novembre 2026");
    expect(lignes[1]).toBe("  09:00 - 10:30 · Données et climat [Panel] — Salle Salle A");
  });

  it("n'écrit l'en-tête de journée qu'une fois, et sépare les journées", () => {
    const texte = formaterProgramme(
      [
        session(),
        session({ startTime: new Date("2026-11-24T11:00:00.000Z") }),
        session({
          day: new Date("2026-11-25T00:00:00.000Z"),
          startTime: new Date("2026-11-25T09:00:00.000Z"),
        }),
      ],
      "fr",
    );

    expect(texte.match(/Mardi 24 novembre 2026/g)).toHaveLength(1);
    expect(texte).toContain("\n\nMercredi 25 novembre 2026");
  });

  it("place le numéro devant le titre, comme le comité le dit à l'oral", () => {
    expect(formaterProgramme([session({ number: 4 })], "fr")).toContain("4. Données et climat");
  });

  it("groupe les intervenants par rôle, modération en tête", () => {
    const texte = formaterProgramme(
      [
        session({
          speakers: [
            {
              role: "PANELIST",
              speaker: { firstName: "Aminata", lastName: "SOW", organization: "Banque mondiale" },
            },
            {
              role: "MODERATOR",
              speaker: {
                civility: "Dr",
                firstName: "Amadou",
                lastName: "BA",
                organization: "ANSD",
              },
            },
            { role: "PANELIST", speaker: { firstName: "João", lastName: "SILVA" } },
          ],
        }),
      ],
      "fr",
    );
    const lignes = texte.split("\n");

    // `ordonnerIntervenants` fait passer la modération devant, même ajoutée
    // après les panélistes.
    expect(lignes[2]).toBe("    Modération : Dr Amadou BA (ANSD)");
    expect(lignes[3]).toBe("    Panéliste : Aminata SOW (Banque mondiale), João SILVA");
  });

  it("suit la langue du destinataire, ponctuation comprise", () => {
    const texte = formaterProgramme(
      [
        session({
          speakers: [{ role: "MODERATOR", speaker: { firstName: "Amadou", lastName: "BA" } }],
        }),
      ],
      "en",
    );

    // Chaque langue garde sa façon d'écrire une date : l'anglais britannique
    // pose une virgule après le jour de la semaine, le français non.
    expect(texte).toContain("Tuesday, 24 November 2026");
    expect(texte).toContain("[Panel] — Room Salle A");
    // Pas d'espace avant le deux-points hors français.
    expect(texte).toContain("    Moderator: Amadou BA");
  });

  it("se passe de salle quand il n'y en a pas", () => {
    expect(formaterProgramme([session({ room: null })], "fr")).not.toContain("Salle");
  });
});

describe("formaterMesPanels", () => {
  function reservation(partiel: Partial<ReservationRecap> = {}): ReservationRecap {
    return { session: session(), statut: "REGISTERED", position: null, ...partiel };
  }

  it("le dit quand rien n'est réservé", () => {
    expect(formaterMesPanels([], "fr")).toContain("aucun panel");
    expect(formaterMesPanels([], "pt")).toContain("nenhum painel");
  });

  it("donne la journée et le créneau de chaque réservation", () => {
    const texte = formaterMesPanels([reservation()], "fr");
    expect(texte).toContain("Mardi 24 novembre 2026");
    expect(texte).toContain("09:00 - 10:30 · Données et climat");
  });

  it("annonce la liste d'attente et son rang", () => {
    // Taire le rang laisserait croire la place acquise.
    const texte = formaterMesPanels([reservation({ statut: "WAITLISTED", position: 3 })], "fr");
    expect(texte).toContain("liste d'attente, position 3");
  });
});

describe("variablesProgrammeUtilisees", () => {
  it("ne retient que celles que le texte emploie", () => {
    expect(variablesProgrammeUtilisees("Bonjour {{prenom}}")).toEqual([]);
    expect(variablesProgrammeUtilisees("Voici : {{programme}}")).toEqual(["programme"]);
    expect(variablesProgrammeUtilisees("{{programme}} {{mes_panels}}")).toEqual([
      "programme",
      "mes_panels",
    ]);
  });

  it("laisse la main à l'appelant qui a déjà fourni la valeur", () => {
    // Une prévisualisation du BackOffice passe un exemple : il ne doit pas
    // être remplacé par le vrai programme.
    expect(variablesProgrammeUtilisees("{{programme}}", { programme: "exemple" })).toEqual([]);
  });
});
