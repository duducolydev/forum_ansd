import { renderHtmlToPdf } from "@/lib/pdf";
import { LIGNES_VIERGES_DEFAUT } from "./lignes-vierges";
import type { FiltrePresence, LigneListe } from "./service";

/**
 * Listes de présence en PDF (brief §5.6).
 *
 * Trois documents, pas un :
 *
 * - **émargement** — liste des attendus avec une colonne de signature vide, à
 *   imprimer *avant* la séance et à faire signer. C'est la pièce qu'on archive.
 * - **constat** — qui est effectivement passé, avec l'heure du premier passage,
 *   à produire *après*. Les absents y figurent aussi, marqués comme tels : une
 *   liste des seuls présents ne permettrait pas de voir qui manque, qui est
 *   pourtant la question qu'on se pose en la lisant.
 * - **vierge** — la même feuille d'émargement, lignes vides (21 novembre
 *   2026). Elle sert à qui n'est pas dans la liste : les porteurs de badges
 *   génériques (`modules/badges/anonymes.ts`) — garde du corps d'une
 *   délégation, chef de protocole, visiteur de passage. Ces cartes n'ont pas
 *   de porteur en base, par construction : leur émargement ne peut donc pas
 *   être pré-rempli, il s'écrit à la main au comptoir d'accueil. Mêmes
 *   colonnes que l'émargement ordinaire, pour que les deux liasses s'archivent
 *   ensemble et se lisent de la même façon.
 *
 * Le HTML est autonome (CSS en ligne, aucune ressource distante) : le rendu
 * n'attend aucun réseau, comme pour les badges.
 */
export type FormeListe = "EMARGEMENT" | "CONSTAT" | "VIERGE";

export interface DonneesListe {
  editionName: string;
  titre: string;
  sousTitre: string;
  jour: Date;
  forme: FormeListe;
  lignes: LigneListe[];
  /**
   * Liste de présence réduite aux présents ou aux absents. `lignes` est alors
   * déjà filtrée, et `attendus` garde le total d'origine, pour situer le
   * nombre : « 12 absent(s) sur 80 attendu(s) ».
   */
  filtre?: FiltrePresence;
  attendus?: number;
  /**
   * Nombre de lignes vides, pour la forme `VIERGE`. `lignes` est alors ignoré :
   * une feuille vierge ne lit pas la base.
   */
  lignesVides?: number;
}

/**
 * Ligne de synthèse sous le titre.
 *
 * Le filtre vaut pour les deux formes depuis le 21 novembre 2026 : une
 * feuille d'émargement réduite aux présents dirait sinon « 2 personne(s)
 * attendue(s) » là où 627 le sont, ce qui est faux et se lit comme un chiffre
 * de fréquentation.
 */
function synthese(donnees: DonneesListe): string {
  /*
   * La feuille vierge ne compte personne : annoncer « 30 personne(s)
   * attendue(s) » sur un document sans un seul nom se lirait comme un chiffre,
   * et c'est exactement le défaut corrigé plus haut pour l'émargement filtré.
   */
  if (donnees.forme === "VIERGE") {
    const lignes = donnees.lignesVides ?? LIGNES_VIERGES_DEFAUT;
    return `${lignes} ligne(s) à remplir sur place`;
  }
  const nombre = donnees.lignes.length;
  const attendus = donnees.attendus ?? nombre;
  if (donnees.filtre === "PRESENTS") return `${nombre} présente(s) sur ${attendus} attendue(s)`;
  if (donnees.filtre === "ABSENTS") return `${nombre} absente(s) sur ${attendus} attendue(s)`;
  if (donnees.forme === "EMARGEMENT") return `${nombre} personne(s) attendue(s)`;
  const presents = donnees.lignes.filter((ligne) => ligne.premierPassage !== null).length;
  return `${nombre} personne(s) attendue(s) · ${presents} présente(s)`;
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

/**
 * Colonnes de la feuille vierge : celles de l'émargement, plus la référence de
 * la carte remise.
 *
 * ## Pourquoi une colonne de plus, alors que les autres sont les mêmes
 *
 * Parce qu'une carte générique n'a pas de porteur en base : son seul rattachement
 * à une personne est **ce document**. Sans la référence imprimée au dos de la
 * carte (`FID-2026-ANON-014`), la feuille dit que quelqu'un est entré, pas quelle
 * carte lui a été remise — et le jour où il faut révoquer une carte perdue, ou
 * dire qui tenait celle qui a badgé trois fois, rien ne répond. C'est d'ailleurs
 * ce que prévoyait déjà la numérotation continue de `modules/badges/anonymes.ts` :
 * « le numéro s'inscrit au registre de remise, en face d'un nom et d'une heure ».
 *
 * Elle vient en deuxième position, juste après le numéro d'ordre : c'est la
 * première chose que l'agent a sous les yeux — la carte est dans sa main — et
 * la dernière qu'il penserait à remplir si elle était en bout de ligne.
 */
const COLONNES_VIERGE = [
  "N°",
  "N° de carte",
  "Nom et prénom",
  "Organisation",
  "Catégorie",
  "Signature",
];

/**
 * Les lignes de la feuille vierge : le numéro d'ordre, et rien d'autre.
 *
 * Le numéro est tout de même imprimé — c'est lui qui permet de dire « sept
 * cartes génériques remises » sans recompter des signatures manuscrites.
 */
function lignesVierges(nombre: number): string {
  const cellules = '<td class="a-remplir carte"></td>' + '<td class="a-remplir"></td>'.repeat(3);
  return Array.from(
    { length: nombre },
    (_, index) =>
      `<tr class="ligne-vide"><td class="num">${index + 1}</td>${cellules}<td class="signature"></td></tr>`,
  ).join("");
}

export function listePresenceHtml(donnees: DonneesListe): string {
  const emargement = donnees.forme === "EMARGEMENT" || donnees.forme === "VIERGE";
  const colonnes = emargement
    ? ["N°", "Nom et prénom", "Organisation", "Catégorie", "Signature"]
    : ["N°", "Nom et prénom", "Organisation", "Catégorie", "Pays", "Passage"];

  if (donnees.forme === "VIERGE") {
    return documentHtml(
      donnees,
      COLONNES_VIERGE,
      lignesVierges(donnees.lignesVides ?? LIGNES_VIERGES_DEFAUT),
    );
  }

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

  return documentHtml(donnees, colonnes, lignes);
}

/**
 * Le document lui-même : en-tête, tableau, pied de page.
 *
 * Séparé du calcul des lignes le 21 novembre 2026, quand la feuille vierge est
 * arrivée : elle ne dérive ses lignes de rien. Dupliquer la feuille de style
 * pour des cellules vides aurait fait diverger les deux documents à la première
 * retouche, et c'est leur ressemblance qui fait qu'ils s'archivent ensemble.
 */
function documentHtml(donnees: DonneesListe, colonnes: string[], lignes: string): string {
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
  /* Feuille vierge : tout s'écrit à la main. Les cellules portent donc le même
     filet que la signature — un trait trop clair ne se suit pas au stylo — et
     le fond reste blanc partout, une ligne grisée se remplissant mal. */
  .ligne-vide td { background: #fff !important; vertical-align: bottom; }
  td.a-remplir { border-bottom: 1px solid #9fb0bf; }
  /* La référence d'une carte tient en une quinzaine de signes
     (FID-2026-ANON-014) : au-delà, la largeur serait prise au nom. */
  td.carte { width: 30mm; }
  /* Réserve de bas de page (21 novembre 2026).

     Le pied de page est en « position: fixed », et un élément fixe se place, à
     l'impression, dans la zone de contenu de chaque page — pas dans la marge.
     Il recouvrait donc la dernière ligne de chaque page : sur une liasse de
     627 noms, une signature sur dix-neuf était barrée d'un « Document généré
     le… ». Un groupe de pied de tableau, répété comme l'en-tête, rend les
     douze millimètres qu'il faut. */
  tfoot { display: table-footer-group; }
  tfoot td { height: 12mm; border: none; background: none !important; padding: 0; }
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
      ${synthese(donnees)}
    </div>
  </header>

  <table>
    <thead><tr>${colonnes.map((colonne) => `<th>${colonne}</th>`).join("")}</tr></thead>
    <tfoot><tr><td colspan="${colonnes.length}"></td></tr></tfoot>
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
