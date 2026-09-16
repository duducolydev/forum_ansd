import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  estFormat,
  neutraliserFormule,
  PDF_MAX_LIGNES,
  versCsv,
  versHtml,
  versXlsx,
} from "./formats";

const COLONNES = ["Identifiant", "Nom", "Organisation"];
const LIGNES: (string | number)[][] = [
  ["FID26-AAA111", "SOW Aminata", "ANSD"],
  ["FID26-BBB222", 'BA "Oumar"', "Le Soleil; Dakar"],
];

describe("export CSV", () => {
  it("commence par un BOM UTF-8", () => {
    // Sans lui, Excel lit le fichier en ANSI et massacre les accents.
    const csv = versCsv(COLONNES, LIGNES);
    expect(csv.subarray(0, 3).toString("hex")).toBe("efbbbf");
  });

  it("échappe les guillemets et neutralise le séparateur", () => {
    const texte = versCsv(COLONNES, LIGNES).toString("utf8");
    expect(texte).toContain('"BA ""Oumar"""');
    // Le point-virgule à l'intérieur d'une valeur ne doit pas décaler la colonne.
    expect(texte).toContain('"Le Soleil; Dakar"');
  });

  it("neutralise les cellules qu'un tableur prendrait pour une formule", () => {
    const texte = versCsv(
      ["Nom", "Organisation"],
      [
        ['=HYPERLINK("https://piege.example";"Cliquez")', "+cmd|' /C calc'!A0"],
        ["-2+3+cmd|' /C calc'!A0", "@SUM(1+1)*cmd|' /C calc'!A0"],
      ],
    ).toString("utf8");

    expect(texte).toContain(`"'=HYPERLINK(""https://piege.example"";""Cliquez"")"`);
    expect(texte).toContain(`"'+cmd|' /C calc'!A0"`);
    expect(texte).toContain(`"'-2+3+cmd|' /C calc'!A0"`);
    expect(texte).toContain(`"'@SUM(1+1)*cmd|' /C calc'!A0"`);
    // Aucune cellule ne commence plus par un déclencheur.
    for (const cellule of texte.replace(/^﻿/, "").split(/;|\r\n/)) {
      expect(cellule).not.toMatch(/^"[=+\-@\t\r]/);
    }
  });

  it("laisse intacts les nombres, les téléphones et le texte ordinaire", () => {
    expect(neutraliserFormule("+221 77 123 45 67")).toBe("+221 77 123 45 67");
    expect(neutraliserFormule("-12.5")).toBe("-12.5");
    expect(neutraliserFormule(-3)).toBe("-3");
    expect(neutraliserFormule("ANSD — Dakar")).toBe("ANSD — Dakar");
    expect(neutraliserFormule("Sénégal = pays hôte")).toBe("Sénégal = pays hôte");
    // Une lettre suffit à rendre un appel de fonction possible.
    expect(neutraliserFormule("+A1")).toBe("'+A1");
    expect(neutraliserFormule("\t=1+1")).toBe("'\t=1+1");
  });

  it("sépare les lignes en CRLF", () => {
    const texte = versCsv(COLONNES, []).toString("utf8");
    expect(versCsv(COLONNES, LIGNES).toString("utf8").split("\r\n")).toHaveLength(3);
    expect(texte.includes("\r\n")).toBe(false);
  });
});

describe("export XLSX", () => {
  it("produit un classeur relisible, en-tête compris", () => {
    const classeur = XLSX.read(versXlsx("Participants", COLONNES, LIGNES), { type: "buffer" });
    const feuille = classeur.Sheets[classeur.SheetNames[0]!]!;
    const relu = XLSX.utils.sheet_to_json<string[]>(feuille, { header: 1 });

    expect(relu[0]).toEqual(COLONNES);
    expect(relu[1]).toEqual(LIGNES[0]);
  });

  it("raccourcit un nom d'onglet trop long pour Excel", () => {
    // Excel refuse au-delà de 31 caractères, et le fichier devient illisible.
    const titre = "Un titre de rapport beaucoup trop long pour un onglet";
    const classeur = XLSX.read(versXlsx(titre, COLONNES, LIGNES), { type: "buffer" });
    expect(classeur.SheetNames[0]!.length).toBeLessThanOrEqual(31);
  });

  it("dimensionne les colonnes sur le contenu", () => {
    // `cellStyles` est indispensable à la relecture : sans lui SheetJS ignore
    // les largeurs à l'ouverture, alors qu'elles sont bien dans le fichier.
    const classeur = XLSX.read(versXlsx("Test", COLONNES, LIGNES), {
      type: "buffer",
      cellStyles: true,
    });
    const largeurs = classeur.Sheets[classeur.SheetNames[0]!]!["!cols"];
    expect(largeurs).toHaveLength(3);
    // La colonne « Organisation » contient « Le Soleil; Dakar », plus long que
    // son en-tête : sa largeur doit suivre le contenu.
    expect(largeurs![2]!.wch).toBeGreaterThan("Organisation".length);
  });
});

describe("rendu PDF", () => {
  const entete = { editionName: "Forum", titre: "Participants", description: "Tous." };

  it("échappe le HTML des valeurs", () => {
    const html = versHtml(entete, COLONNES, [["<script>alert(1)</script>", "x", "y"]]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("répète l'en-tête de tableau sur chaque page", () => {
    // Une liste de deux cents lignes sans en-tête répété est illisible dès la
    // deuxième page.
    expect(versHtml(entete, COLONNES, LIGNES)).toContain("thead { display: table-header-group; }");
  });

  it("se met en paysage : quinze colonnes ne tiennent pas en portrait", () => {
    expect(versHtml(entete, COLONNES, LIGNES)).toContain("size: A4 landscape");
  });

  it("borne le PDF et le dit dans le document", () => {
    // Mesuré : un PDF de 1 500 lignes demande 10 s et pèse 6,8 Mo, et personne
    // ne le lit. Le plafond doit être visible dans le document lui-même.
    const lignes = Array.from({ length: PDF_MAX_LIGNES + 50 }, (_, index) => [
      `ID-${index}`,
      "Nom",
      "Org",
    ]);
    const tronque = { ...entete, description: `${entete.description} — document limité` };
    expect(versHtml(tronque, COLONNES, lignes.slice(0, PDF_MAX_LIGNES))).toContain(
      "document limité",
    );
  });
});

describe("choix du format", () => {
  it("n'accepte que les trois formats prévus", () => {
    expect(estFormat("csv")).toBe(true);
    expect(estFormat("xlsx")).toBe(true);
    expect(estFormat("pdf")).toBe(true);
    expect(estFormat("exe")).toBe(false);
    expect(estFormat(null)).toBe(false);
  });
});
