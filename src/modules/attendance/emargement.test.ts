import { describe, expect, it } from "vitest";
import { listePresenceHtml } from "./pdf";
import type { LigneListe } from "./service";

/**
 * Feuille d'émargement et liste de présence, filtrées (21 novembre 2026).
 *
 * Le filtre « présents / absents » ne valait que pour le constat ; il vaut
 * désormais aussi pour l'émargement. Ce qui se teste ici n'est pas le
 * filtrage — `filtrerParPresence` s'en charge et a ses propres cas — mais la
 * **ligne de synthèse**, qui disait « 2 personne(s) attendue(s) » sur une
 * feuille réduite à deux présents alors que six cents étaient attendus. Un
 * document imprimé qui annonce un faux total se lit comme un chiffre de
 * fréquentation, et c'est ainsi qu'on se trompe en réunion.
 *
 * Ces tests ne touchent ni la base ni Puppeteer : `listePresenceHtml` est le
 * HTML, avant le rendu.
 */

const JOUR = new Date("2026-11-23T00:00:00.000Z");

function ligne(nom: string, premierPassage: Date | null): LigneListe {
  return {
    publicId: nom,
    nom,
    organisation: "ANSD",
    fonction: "Statisticien",
    categorie: "Délégué",
    pays: "Sénégal",
    premierPassage,
  };
}

const PRESENTS = [
  ligne("DIOP Awa", new Date("2026-11-23T08:15:00.000Z")),
  ligne("SOW Mamadou", new Date("2026-11-23T08:42:00.000Z")),
];

const base = {
  editionName: "Forum international sur les données",
  titre: "Feuille d'émargement",
  sousTitre: "Toutes catégories",
  jour: JOUR,
} as const;

describe("synthèse de la feuille d'émargement", () => {
  it("situe un émargement réduit aux présents dans le total attendu", () => {
    const html = listePresenceHtml({
      ...base,
      forme: "EMARGEMENT",
      lignes: PRESENTS,
      filtre: "PRESENTS",
      attendus: 627,
    });
    expect(html).toContain("2 présente(s) sur 627 attendue(s)");
    expect(html).not.toContain("2 personne(s) attendue(s)");
  });

  it("fait de même pour un émargement réduit aux absents", () => {
    const html = listePresenceHtml({
      ...base,
      forme: "EMARGEMENT",
      lignes: PRESENTS,
      filtre: "ABSENTS",
      attendus: 627,
    });
    expect(html).toContain("2 absente(s) sur 627 attendue(s)");
  });

  it("garde son libellé d'origine quand rien n'est filtré", () => {
    const html = listePresenceHtml({
      ...base,
      forme: "EMARGEMENT",
      lignes: PRESENTS,
      filtre: "TOUS",
      attendus: 2,
    });
    expect(html).toContain("2 personne(s) attendue(s)");
  });

  it("conserve la colonne signature, qui fait l'émargement", () => {
    // Un émargement filtré reste un émargement : sans colonne à signer, le
    // document ne sert plus à rien.
    const html = listePresenceHtml({
      ...base,
      forme: "EMARGEMENT",
      lignes: PRESENTS,
      filtre: "PRESENTS",
      attendus: 627,
    });
    expect(html).toContain('class="signature"');
  });

  it("laisse le constat se comporter comme avant", () => {
    const html = listePresenceHtml({
      ...base,
      titre: "Liste de présence",
      forme: "CONSTAT",
      lignes: [...PRESENTS, ligne("BA Fatou", null)],
      filtre: "TOUS",
      attendus: 3,
    });
    expect(html).toContain("3 personne(s) attendue(s) · 2 présente(s)");
    expect(html).not.toContain('class="signature"');
  });
});
