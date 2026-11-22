import { describe, expect, it } from "vitest";
import { LIGNES_VIERGES_DEFAUT } from "./lignes-vierges";
import { type DonneesListe, listePresenceHtml, piedDePageHtml } from "./pdf";
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
   * teste ici : qu'elle ait bien les colonnes qu'on remplit à la main, le
   * nombre de lignes voulu, et rien de ce qu'elle ne peut pas savoir — aucun
   * nom, aucune date.
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

    it("garde les colonnes qu'on remplit, et pas celles du constat", () => {
      const html = vierge(5);
      expect(html).toContain("<th>Nom et prénom</th>");
      expect(html).toContain("<th>Organisation</th>");
      expect(html).toContain("<th>Signature</th>");
      expect(html).not.toContain("<th>Passage</th>");
      expect(html).not.toContain("<th>Pays</th>");
    });

    /*
     * La catégorie est au titre, pas sur chaque ligne : une liasse vierge se
     * tire par catégorie, et la réécrire soixante fois à la main prenait la
     * largeur du nom et de l'organisation, qui, eux, s'écrivent vraiment.
     */
    it("n'a pas de colonne « Catégorie », que porte déjà le titre", () => {
      expect(vierge(5)).not.toContain("<th>Catégorie</th>");
      // Elle reste sur la feuille nominative, qui la tire de la base.
      expect(
        listePresenceHtml({ ...base, forme: "EMARGEMENT", lignes: PRESENTS, attendus: 2 }),
      ).toContain("<th>Catégorie</th>");
    });

    /*
     * Sur un document déjà rempli, l'alternance de fonds suffit à suivre une
     * ligne. Sur une feuille qu'on remplit à la main, rien n'indique où
     * s'arrête une colonne : les écritures mordent sur la voisine.
     */
    it("sépare les colonnes par un filet vertical", () => {
      expect(vierge(5)).toContain('<table class="vierge">');
      expect(vierge(5)).toContain("table.vierge thead th, table.vierge tbody td { border-right");
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

    it("ne porte aucun nom", () => {
      // Les lignes passées sont ignorées : une feuille vierge qui laisserait
      // filtrer un nom ne serait plus vierge.
      const html = listePresenceHtml({
        ...base,
        forme: "VIERGE",
        lignes: PRESENTS,
        lignesVides: 4,
      });
      expect(html).not.toContain("DIOP Awa");
      expect(html).not.toContain("personne(s) attendue(s)");
    });

    /*
     * La date d'émargement, rétablie le 22 novembre 2026. Retirée la veille au
     * motif qu'une liasse tirée d'avance la porterait à faux, elle manquait à
     * l'archive : une feuille signée sans date ne dit pas de quelle journée du
     * Forum elle vient. C'est au tirage de suivre la journée, une liasse par
     * jour.
     *
     * Le décompte de lignes, lui, reste absent : celui qui tient la feuille
     * voit les lignes, celui qui l'archive compte les signatures.
     */
    it("porte la date d'émargement sous son titre", () => {
      const html = vierge(4);
      expect(html).toContain(base.sousTitre);
      expect(html).toContain("lundi 23 novembre 2026");
    });

    it("ne porte pas de décompte de lignes", () => {
      expect(vierge(4)).not.toContain("ligne(s) à remplir");
    });

    it("donne de quoi écrire : les cellules à remplir portent un filet", () => {
      const html = vierge(3);
      // Trois cellules à remplir par ligne — carte, nom, organisation —, la
      // signature ayant déjà la sienne.
      expect(compter(html, "a-remplir")).toBe(3 * 3 + 1);
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

/**
 * En-tête et pied de page (22 novembre 2026).
 *
 * Les listes de présence portent les mêmes logos que les courriels et les
 * badges : le Forum en haut à droite, les 20 ans de l'ANSD en bas à droite.
 * Les logos sont passés en `data:` URI — le rendu n'attend aucun réseau — et
 * le pied de page est un fragment à part, que Chromium imprime dans la marge
 * basse de chaque page, seul endroit où un numéro de page est possible.
 */
describe("habillage des listes de présence", () => {
  const LOGO_FORUM = "data:image/webp;base64,Rk9SVU0=";
  const LOGO_ANSD = "data:image/webp;base64,QU5TRA==";

  const avecLogos: DonneesListe = {
    ...base,
    forme: "VIERGE",
    lignes: [],
    lignesVides: 3,
    logoForumDataUrl: LOGO_FORUM,
    logoAnsdDataUrl: LOGO_ANSD,
  };

  it("place le logo du Forum à droite du titre, dans l'en-tête", () => {
    const html = listePresenceHtml(avecLogos);
    expect(html).toContain(`<img class="logo-forum" src="${LOGO_FORUM}"`);
    // À droite du titre : après le bloc d'identité, et toujours dans l'en-tête.
    const logo = html.indexOf('class="logo-forum" src=');
    expect(logo).toBeGreaterThan(html.indexOf("<h1>"));
    expect(logo).toBeLessThan(html.indexOf("</header>"));
  });

  it("se compose sans logo quand le fichier manque", () => {
    // Une feuille d'émargement sans logo reste une feuille d'émargement :
    // l'export ne doit pas échouer pour un fichier absent.
    const html = listePresenceHtml({ ...avecLogos, logoForumDataUrl: null });
    expect(html).not.toContain('logo-forum" src');
    expect(html).toContain("<h1>Feuille d'émargement</h1>");
  });

  it("numérote les pages à gauche du pied de page", () => {
    // Chromium remplit lui-même ces deux marqueurs, page par page.
    const pied = piedDePageHtml(avecLogos);
    expect(pied).toContain('<span class="pageNumber">');
    expect(pied).toContain('<span class="totalPages">');
    expect(pied.indexOf('class="pageNumber"')).toBeLessThan(pied.indexOf(LOGO_ANSD));
  });

  it("met le logo des 20 ans de l'ANSD à droite du pied de page", () => {
    const pied = piedDePageHtml(avecLogos);
    expect(pied).toContain(`<img src="${LOGO_ANSD}"`);
    // Dernière mention de la ligne : le logo ferme le pied de page.
    expect(pied.indexOf(LOGO_ANSD)).toBeGreaterThan(pied.indexOf("Document généré le"));
    expect(pied).not.toContain("undefined");
  });

  it("garde le pied de page hors du document, où il ne mord sur aucune ligne", () => {
    // Il est rendu dans la marge d'impression, pas dans la page : plus de
    // « position: fixed » sur la dernière signature, et plus de réserve de bas
    // de tableau à lui ménager.
    const html = listePresenceHtml(avecLogos);
    expect(html).not.toContain("<footer>");
    expect(html).not.toContain("<tfoot>");
  });
});
