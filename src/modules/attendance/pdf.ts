import { renderHtmlToPdf } from "@/lib/pdf";
import type { LigneListe } from "./service";

/**
 * Listes de présence en PDF (brief §5.6).
 *
 * Deux documents, pas un :
 *
 * - **émargement** — liste des attendus avec une colonne de signature vide, à
 *   imprimer *avant* la séance et à faire signer. C'est la pièce qu'on archive.
 * - **constat** — qui est effectivement passé, avec l'heure du premier passage,
 *   à produire *après*. Les absents y figurent aussi, marqués comme tels : une
 *   liste des seuls présents ne permettrait pas de voir qui manque, qui est
 *   pourtant la question qu'on se pose en la lisant.
 *
 * Le HTML est autonome (CSS en ligne, aucune ressource distante) : le rendu
 * n'attend aucun réseau, comme pour les badges.
 */
export type FormeListe = "EMARGEMENT" | "CONSTAT";

export interface DonneesListe {
  editionName: string;
  titre: string;
  sousTitre: string;
  jour: Date;
  forme: FormeListe;
  lignes: LigneListe[];
}

const ANSD_BLEU_NUIT = "#082c4e";
const ANSD_BLEU_VIF = "#2f7fd1";

function escapeHtml(valeur: string): string {
  return valeur
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const heure = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function listePresenceHtml(donnees: DonneesListe): string {
  const emargement = donnees.forme === "EMARGEMENT";
  const presents = donnees.lignes.filter((ligne) => ligne.premierPassage !== null).length;

  const colonnes = emargement
    ? ["N°", "Nom et prénom", "Organisation", "Catégorie", "Signature"]
    : ["N°", "Nom et prénom", "Organisation", "Catégorie", "Pays", "Passage"];

  const lignes = donnees.lignes
    .map((ligne, index) => {
      const cellules = emargement
        ? [
            String(index + 1),
            escapeHtml(ligne.nom),
            escapeHtml(ligne.organisation ?? "—"),
            escapeHtml(ligne.categorie),
            "",
          ]
        : [
            String(index + 1),
            escapeHtml(ligne.nom),
            escapeHtml(ligne.organisation ?? "—"),
            escapeHtml(ligne.categorie),
            escapeHtml(ligne.pays),
            ligne.premierPassage
              ? heure.format(ligne.premierPassage)
              : '<span class="absent">absent</span>',
          ];

      const absent = !emargement && ligne.premierPassage === null;
      return `<tr class="${absent ? "ligne-absent" : ""}">${cellules
        .map((cellule, colonne) => {
          if (emargement && colonne === 4) return '<td class="signature"></td>';
          return `<td${colonne === 0 ? ' class="num"' : ""}>${cellule}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 portrait; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    /* Fond blanc explicite : sans lui, un visualiseur en thème sombre peint le
       sien derrière la page et rend le document illisible. Le PDF imprime bien,
       mais il est d'abord lu à l'écran. */
    background: #fff;
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 9.5pt;
    color: #10202f;
  }
  header {
    border-bottom: 2px solid ${ANSD_BLEU_NUIT};
    padding-bottom: 6mm;
    margin-bottom: 5mm;
  }
  .edition { font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: ${ANSD_BLEU_VIF}; }
  h1 { margin: 2mm 0 1mm; font-size: 15pt; color: ${ANSD_BLEU_NUIT}; }
  .meta { font-size: 9pt; color: #4e5d6b; }
  table { width: 100%; border-collapse: collapse; }
  /* Les en-têtes se répètent en haut de chaque page : une liste de 300 noms
     tient sur huit pages, et sans cela la moitié serait illisible. */
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th {
    text-align: left;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: .04em;
    color: #4e5d6b;
    border-bottom: 1px solid #c7d2dc;
    padding: 2mm 1.5mm;
  }
  td { padding: 2mm 1.5mm; border-bottom: 1px solid #e6ecf2; vertical-align: middle; }
  td.num { color: #8a97a3; width: 8mm; }
  /* Une signature manuscrite demande de la place : à hauteur de ligne
     normale, la colonne serait trop étroite pour être utilisable. */
  td.signature { width: 45mm; height: 11mm; background: none !important; border-bottom: 1px solid #9fb0bf; }
  .ligne-absent td { color: #8a97a3; }
  .absent { font-style: italic; }
  tbody tr:nth-child(even) td { background: #f6f9fb; }
  footer {
    position: fixed;
    bottom: 6mm; left: 0; right: 0;
    font-size: 7.5pt;
    color: #8a97a3;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>
  <header>
    <div class="edition">${escapeHtml(donnees.editionName)}</div>
    <h1>${escapeHtml(donnees.titre)}</h1>
    <div class="meta">
      ${escapeHtml(donnees.sousTitre)} · ${dateLongue.format(donnees.jour)}<br>
      ${donnees.lignes.length} personne(s) attendue(s)${
        emargement ? "" : ` · ${presents} présente(s)`
      }
    </div>
  </header>

  <table>
    <thead><tr>${colonnes.map((colonne) => `<th>${colonne}</th>`).join("")}</tr></thead>
    <tbody>${lignes}</tbody>
  </table>

  <footer>
    <span>${escapeHtml(donnees.editionName)}</span>
    <span>Document généré le ${dateLongue.format(new Date())}</span>
  </footer>
</body>
</html>`;
}

export async function renderListePresence(donnees: DonneesListe): Promise<Buffer> {
  return renderHtmlToPdf(listePresenceHtml(donnees), { format: "A4" });
}
