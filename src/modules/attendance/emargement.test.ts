import { describe, expect, it } from "vitest";
import { LIGNES_VIERGES_DEFAUT } from "./lignes-vierges";
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

  /**
   * Feuille vierge (21 novembre 2026).
   *
   * Elle sert aux porteurs de badges génériques, qui n'ont pas de fiche en base
   * et ne peuvent donc figurer sur aucune liste tirée de la base. Ce qui se
   * teste ici : qu'elle ait bien les colonnes de l'émargement — c'est la
   * demande —, le nombre de lignes voulu, et aucun nom.
   */
  describe("feuille vierge", () => {
    const vierge = (lignesVides?: number) =>
      listePresenceHtml({
        ...base,
        titre: "Feuille d'émargement vierge",
        forme: "VIERGE",
        lignes: [],
        lignesVides,
      });

    function compter(html: string, motif: string): number {
      return html.split(motif).length - 1;
    }

    it("imprime autant de lignes vides que demandé", () => {
      expect(compter(vierge(12), 'class="ligne-vide"')).toBe(12);
      expect(compter(vierge(12), 'class="signature"')).toBe(12);
    });

    it("tient sur deux pages par défaut", () => {
      expect(compter(vierge(), 'class="ligne-vide"')).toBe(LIGNES_VIERGES_DEFAUT);
    });

    it("garde les colonnes de la feuille d'émargement, et pas celles du constat", () => {
      const html = vierge(5);
      expect(html).toContain("<th>Nom et prénom</th>");
      expect(html).toContain("<th>Organisation</th>");
      expect(html).toContain("<th>Catégorie</th>");
      expect(html).toContain("<th>Signature</th>");
      expect(html).not.toContain("<th>Passage</th>");
      expect(html).not.toContain("<th>Pays</th>");
    });

    /*
     * La seule colonne en plus. Une carte générique n'a pas de porteur en base :
     * sans sa référence sur cette feuille, rien ne dit quelle carte a été
     * remise à qui, et une carte perdue ne se révoque au nom de personne.
     */
    it("ajoute la référence de la carte, juste après le numéro d'ordre", () => {
      const html = vierge(5);
      expect(html).toContain("<th>N° de carte</th>");
      expect(html.indexOf("<th>N° de carte</th>")).toBeLessThan(
        html.indexOf("<th>Nom et prénom</th>"),
      );
      expect(compter(html, 'class="a-remplir carte"')).toBe(5);
      // Elle ne déborde pas sur le nom : sa largeur est fixée.
      expect(html).toContain("td.carte { width:");
    });

    it("ne porte aucun nom, et aucun décompte de participants", () => {
      // Les lignes passées sont ignorées : une feuille vierge qui laisserait
      // filtrer un nom ne serait plus vierge.
      const html = listePresenceHtml({
        ...base,
        forme: "VIERGE",
        lignes: PRESENTS,
        lignesVides: 4,
      });
      expect(html).not.toContain("DIOP Awa");
      expect(html).toContain("4 ligne(s) à remplir sur place");
      expect(html).not.toContain("personne(s) attendue(s)");
    });

    it("donne de quoi écrire : les cellules à remplir portent un filet", () => {
      const html = vierge(3);
      // Quatre cellules à remplir par ligne — carte, nom, organisation,
      // catégorie —, la signature ayant déjà la sienne.
      expect(compter(html, "a-remplir")).toBe(4 * 3 + 1);
      expect(html).toContain("td.a-remplir { border-bottom");
    });
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
