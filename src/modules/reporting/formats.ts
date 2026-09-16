import * as XLSX from "xlsx";
import { renderHtmlToPdf } from "@/lib/pdf";

/**
 * Mise en forme des rapports (brief §5.13).
 *
 * Les trois formats partent des **mêmes lignes** : un rapport se décrit une
 * fois, dans `service.ts`, et ne connaît pas son format de sortie. C'est ce qui
 * garantit qu'un chiffre lu dans le PDF est celui du XLSX.
 */
/**
 * Plafond de lignes du PDF.
 *
 * Mesuré sur 1 500 participants : le CSV sort en 486 ms, le XLSX en 878 ms, mais
 * le PDF demande **9,9 secondes et pèse 6,8 Mo**. Le brief prévoyait un mode
 * asynchrone au-delà de 1 000 lignes ; la mesure montre que le problème n'est
 * pas le volume en soi mais le seul format PDF — et surtout qu'un PDF de
 * 1 500 lignes n'est pas un document qu'on lit ou qu'on imprime.
 *
 * Le PDF est donc **borné à 300 lignes** (environ huit pages en paysage), avec
 * un avertissement dans le document et sur l'écran. Au-delà, c'est le tableur
 * qu'il faut, et il sort en moins d'une seconde. Cela rend le mode asynchrone
 * inutile plutôt que de le construire pour un cas qui ne se présente plus.
 * **À faire confirmer par l'ANSD** en même temps que le contenu du §23.
 */
export const PDF_MAX_LIGNES = 300;

export type FormatRapport = "csv" | "xlsx" | "pdf";

export function estFormat(valeur: string | null): valeur is FormatRapport {
  return valeur === "csv" || valeur === "xlsx" || valeur === "pdf";
}

/**
 * Neutralise une cellule qu'un tableur prendrait pour une formule (PLAN.md §18).
 *
 * Excel interprète une cellule CSV commençant par `=`, `+`, `-` ou `@` comme une
 * formule, **même entre guillemets**. Or les noms, organisations et fonctions
 * viennent du formulaire d'inscription public, et l'IP du journal d'audit d'un
 * en-tête : `=HYPERLINK("https://…";"Cliquez")` saisi comme organisation
 * devenait un lien piégé dans le rapport ouvert par un administrateur. Une
 * apostrophe en tête fait lire la cellule comme du texte (recommandation OWASP,
 * « CSV Injection »). La tabulation et le retour chariot en tête, autres
 * déclencheurs connus, sont traités de même.
 *
 * Exception : un nombre ou un numéro de téléphone (`+221 77 123 45 67`, `-12`)
 * reste tel quel. Sans lettre, une cellule ne peut appeler aucune fonction ; lui
 * ajouter une apostrophe l'afficherait pour rien dans chaque ligne.
 *
 * Seul le CSV est concerné : le XLSX type ses cellules en texte et le PDF
 * n'évalue rien.
 */
export function neutraliserFormule(valeur: string | number): string {
  const texte = String(valeur);
  if (typeof valeur === "number") return texte;
  if (!/^[=+\-@\t\r]/.test(texte)) return texte;
  if (/^[+-]?[\d\s().]+$/.test(texte)) return texte;
  return `'${texte}`;
}

export function versCsv(colonnes: string[], lignes: (string | number)[][]): Buffer {
  const echapper = (valeur: string | number) =>
    `"${neutraliserFormule(valeur).replaceAll('"', '""')}"`;
  const contenu = [
    colonnes.map(echapper).join(";"),
    ...lignes.map((ligne) => ligne.map(echapper).join(";")),
  ].join("\r\n");

  // BOM UTF-8 : sans lui, Excel lit le fichier en ANSI et massacre les accents,
  // ce qui rend le rapport inutilisable pour qui le reçoit.
  return Buffer.from(`﻿${contenu}`, "utf8");
}

export function versXlsx(titre: string, colonnes: string[], lignes: (string | number)[][]): Buffer {
  const feuille = XLSX.utils.aoa_to_sheet([colonnes, ...lignes]);

  // Largeurs de colonnes calculées sur le contenu réel : sans cela toutes les
  // colonnes sortent à la même largeur et les noms longs apparaissent tronqués,
  // ce qui fait douter des données.
  feuille["!cols"] = colonnes.map((entete, index) => {
    const plusLong = lignes.reduce(
      (maximum, ligne) => Math.max(maximum, String(ligne[index] ?? "").length),
      entete.length,
    );
    return { wch: Math.min(Math.max(plusLong + 2, 8), 50) };
  });
  // Fige la ligne d'en-tête : une liste de 1 500 lignes se lit mal sans elle.
  feuille["!freeze"] = { xSplit: 0, ySplit: 1 };

  const classeur = XLSX.utils.book_new();
  // Excel refuse les noms d'onglet de plus de 31 caractères et certains signes.
  XLSX.utils.book_append_sheet(classeur, feuille, titre.replace(/[\\/?*[\]:]/g, "").slice(0, 31));

  return XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function echapperHtml(valeur: string | number): string {
  return String(valeur)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export interface EnTetePdf {
  editionName: string;
  titre: string;
  description: string;
}

export function versHtml(
  entete: EnTetePdf,
  colonnes: string[],
  lignes: (string | number)[][],
): string {
  const dateLongue = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  });

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<style>
  /* Paysage : les rapports comptent jusqu'à quinze colonnes, qui ne tiennent
     pas en portrait sans réduire la police au-delà du lisible. */
  @page { size: A4 landscape; margin: 12mm 10mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: #10202f; font-family: "Helvetica Neue", Arial, sans-serif; font-size: 8pt; }
  header { border-bottom: 2px solid #082c4e; padding-bottom: 4mm; margin-bottom: 4mm; }
  .edition { font-size: 7pt; letter-spacing: .08em; text-transform: uppercase; color: #2f7fd1; }
  h1 { margin: 1.5mm 0 1mm; font-size: 13pt; color: #082c4e; }
  .meta { font-size: 8pt; color: #4e5d6b; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: .03em; color: #4e5d6b; border-bottom: 1px solid #c7d2dc; padding: 1.5mm 1mm; }
  td { padding: 1.5mm 1mm; border-bottom: 1px solid #e6ecf2; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f6f9fb; }
  footer { position: fixed; bottom: 5mm; left: 0; right: 0; font-size: 7pt; color: #8a97a3; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <header>
    <div class="edition">${echapperHtml(entete.editionName)}</div>
    <h1>${echapperHtml(entete.titre)}</h1>
    <div class="meta">${echapperHtml(entete.description)}<br>${lignes.length} ligne(s)</div>
  </header>
  <table>
    <thead><tr>${colonnes.map((colonne) => `<th>${echapperHtml(colonne)}</th>`).join("")}</tr></thead>
    <tbody>${lignes
      .map(
        (ligne) =>
          `<tr>${ligne.map((cellule) => `<td>${echapperHtml(cellule)}</td>`).join("")}</tr>`,
      )
      .join("")}</tbody>
  </table>
  <footer>
    <span>${echapperHtml(entete.editionName)}</span>
    <span>Édité le ${dateLongue.format(new Date())}</span>
  </footer>
</body>
</html>`;
}

export async function versPdf(
  entete: EnTetePdf,
  colonnes: string[],
  lignes: (string | number)[][],
): Promise<Buffer> {
  const tronque = lignes.length > PDF_MAX_LIGNES;
  const retenues = tronque ? lignes.slice(0, PDF_MAX_LIGNES) : lignes;
  const enTete = tronque
    ? {
        ...entete,
        description: `${entete.description} — document limité aux ${PDF_MAX_LIGNES} premières lignes sur ${lignes.length} ; utilisez l'export Excel pour la liste complète.`,
      }
    : entete;

  return renderHtmlToPdf(versHtml(enTete, colonnes, retenues), {
    format: "A4",
    landscape: true,
  });
}
