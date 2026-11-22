import { renderHtmlToPdf } from "@/lib/pdf";
import { LIGNES_VIERGES_DEFAUT } from "./lignes-vierges";
import { logoAnsdDataUrl, logoForumDataUrl } from "./logos";
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
  /**
   * Logos en `data:` URI (`modules/attendance/logos.ts`) : le Forum en haut à
   * droite de l'en-tête, les 20 ans de l'ANSD en bas à droite du pied de page.
   *
   * Optionnels, et `null` quand le fichier manque : le document se compose
   * alors sans eux. Ils sont passés en paramètre plutôt que lus ici parce que
   * `listePresenceHtml` est synchrone — c'est `renderListePresence` qui lit les
   * fichiers.
   */
  logoForumDataUrl?: string | null;
  logoAnsdDataUrl?: string | null;
}

/**
 * Ligne de synthèse sous le titre.
 *
 * Le filtre vaut pour les deux formes depuis le 21 novembre 2026 : une
 * feuille d'émargement réduite aux présents dirait sinon « 2 personne(s)
 * attendue(s) » là où 627 le sont, ce qui est faux et se lit comme un chiffre
 * de fréquentation.
 */
/**
 * La ligne sous le titre.
 *
 * **La feuille vierge porte son sous-titre et la date** (rétablie le 22
 * novembre 2026), mais pas de décompte de lignes.
 *
 * - La **date** est celle du jour d'émargement demandé à l'écran. Elle avait
 *   été retirée la veille, au motif qu'une liasse tirée d'avance et resservie
 *   le surlendemain la porterait à faux ; une feuille signée sans date est
 *   pourtant inexploitable à l'archive, où rien d'autre ne dit de quelle
 *   journée du Forum elle vient. C'est donc au tirage de suivre la journée —
 *   une liasse par jour —, et non au document de se taire. (Si une liasse
 *   indatée redevenait nécessaire, c'est une mention à remplir à la main
 *   qu'il faudrait imprimer, pas l'absence de toute mention.)
 * - Le **décompte** (« 152 ligne(s) à remplir ») ne disait rien à personne :
 *   celui qui tient la feuille voit les lignes, et celui qui l'archive compte
 *   les signatures, pas les lignes vides.
 */
function meta(donnees: DonneesListe): string {
  const entete = `${escapeHtml(donnees.sousTitre)} · ${dateLongue.format(donnees.jour)}`;
  if (donnees.forme === "VIERGE") return entete;
  return `${entete}<br>${synthese(donnees)}`;
}

function synthese(donnees: DonneesListe): string {
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
 * Colonnes de la feuille vierge.
 *
 * ## La référence de la carte, en deuxième position
 *
 * Une carte générique n'a pas de porteur en base : son seul rattachement à une
 * personne est **ce document**. Sans la référence imprimée au dos de la carte
 * (`FID-2026-ANON-014`), la feuille dit que quelqu'un est entré, pas quelle
 * carte lui a été remise — et le jour où il faut révoquer une carte perdue, ou
 * dire qui tenait celle qui a badgé trois fois, rien ne répond. C'est ce que
 * prévoyait déjà la numérotation continue de `modules/badges/anonymes.ts` :
 * « le numéro s'inscrit au registre de remise, en face d'un nom et d'une
 * heure ». Elle vient juste après le numéro d'ordre parce que la carte est dans
 * la main de l'agent au moment où il remplit la ligne.
 *
 * ## Pas de catégorie (21 novembre 2026, après impression d'essai)
 *
 * La feuille d'émargement nominative porte une colonne « Catégorie » ; celle-ci
 * ne l'a plus. Une liasse de feuilles vierges se tire **par catégorie** — le
 * titre la porte déjà —, et redemander à la main, sur chaque ligne, ce que le
 * haut de page affirme ne fait que prendre la largeur du nom et de
 * l'organisation, qui, eux, s'écrivent vraiment.
 */
const COLONNES_VIERGE = ["N°", "N° de carte", "Nom et prénom", "Organisation", "Signature"];

/**
 * Les lignes de la feuille vierge : le numéro d'ordre, et rien d'autre.
 *
 * Le numéro est tout de même imprimé — c'est lui qui permet de dire « sept
 * cartes génériques remises » sans recompter des signatures manuscrites.
 */
function lignesVierges(nombre: number): string {
  const cellules = '<td class="a-remplir carte"></td>' + '<td class="a-remplir"></td>'.repeat(2);
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
  const logoForum = donnees.logoForumDataUrl
    ? `<img class="logo-forum" src="${donnees.logoForumDataUrl}" alt="">`
    : "";

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<style>
  /* Aucune marge ici : elles viennent des options de rendu (« MARGES »).

     C'est dans la marge d'impression que Chromium place le pied de page, et il
     ne connaît là que celles qu'on lui passe. Mais une marge déclarée en CSS
     l'emporte sur elles pour la **mise en page** : avec « margin: 0 », le
     tableau courait jusqu'au bas de la feuille et sa dernière ligne passait
     sous le pied de page (constaté à l'impression d'essai du 22 novembre
     2026). On n'en déclare donc aucune, et les deux coïncident. */
  @page { size: A4 portrait; }
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8mm;
  }
  /* Logo du Forum à droite du titre (22 novembre 2026). Largeur fixée, hauteur
     libre : à 38 mm, le logo (1 000 × 441) reste au-dessus des 300 ppp d'une
     impression, et sa hauteur (≈ 17 mm) est celle du bloc de titre — l'en-tête
     ne grandit donc pas, et la première page garde ses lignes. « flex: none »
     l'empêche d'être comprimé par un titre long. */
  .logo-forum { width: 38mm; height: auto; flex: none; }
  /* « min-width: 0 » : sans lui, un titre long pousserait le logo hors de la page
     au lieu de passer à la ligne. */
  .identite { min-width: 0; }
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
  /* Filets verticaux, sur la feuille vierge seulement (21 novembre 2026).

     Sur un document imprimé qui porte déjà les noms, l'alternance de fonds
     suffit à suivre une ligne. Sur une feuille qu'on remplit à la main, rien
     n'indique où s'arrête une colonne : les écritures mordent sur la voisine,
     et une organisation un peu longue finit en travers de la signature. */
  table.vierge thead th, table.vierge tbody td { border-right: 1px solid #c7d2dc; }
  table.vierge thead th:last-child, table.vierge tbody td:last-child { border-right: none; }
  /* Plus de réserve de bas de page, et plus de pied de page dans le document
     (22 novembre 2026).

     Le pied était un élément « position: fixed » : à l'impression, un élément
     fixe se répète bien sur chaque page, mais dans la zone de **contenu** — pas
     dans la marge. Il recouvrait donc la dernière ligne de chaque page, et on
     lui réservait douze millimètres par un groupe de pied de tableau.

     Il est désormais rendu par Chromium dans la marge basse (« piedDePageHtml »,
     passé à « renderHtmlToPdf »), seul endroit où il peut numéroter les pages.
     Il ne mord plus sur rien : la réserve n'a plus d'objet, et ses douze
     millimètres reviennent aux lignes. */
</style>
</head>
<body>
  <header>
    <div class="identite">
      <div class="edition">${escapeHtml(donnees.editionName)}</div>
      <h1>${escapeHtml(donnees.titre)}</h1>
      <div class="meta">${meta(donnees)}</div>
    </div>
    ${logoForum}
  </header>

  <table${donnees.forme === "VIERGE" ? ' class="vierge"' : ""}>
    <thead><tr>${colonnes.map((colonne) => `<th>${colonne}</th>`).join("")}</tr></thead>
    <tbody>${lignes}</tbody>
  </table>
</body>
</html>`;
}

/**
 * Marges d'impression, et donc place du pied de page.
 *
 * Elles reprennent celles que portait `@page` (14 mm en tête, 12 mm sur les
 * côtés), la marge basse passant de 16 à 18 mm : c'est elle qui reçoit
 * maintenant le pied de page, logo compris.
 */
const MARGES = { haut: "14mm", droite: "12mm", bas: "18mm", gauche: "12mm" } as const;

/**
 * Le pied de page, rendu par Chromium dans la marge basse de **chaque** page
 * (22 novembre 2026).
 *
 * Trois mentions, de gauche à droite :
 *
 * - le **numéro de page**, `Page 3 / 8`. Une liasse d'émargement se signe, se
 *   ramasse et s'archive : sans numéro, une page tombée du paquet ne se
 *   retrouve pas, et personne ne peut dire si la liasse est complète. Chromium
 *   remplit lui-même `pageNumber` et `totalPages` ;
 * - l'édition et la date d'édition, qui étaient déjà là ;
 * - le **logo des 20 ans de l'ANSD**.
 *
 * Le gabarit est rendu dans un document à part, sans la feuille de style de la
 * page : tout y est en style en ligne, et le logo en `data:` URI. Les tailles
 * y sont des unités d'impression ordinaires (mm, pt), Chromium ne leur
 * appliquant aucune échelle particulière — vérifié au rendu.
 */
export function piedDePageHtml(donnees: DonneesListe): string {
  const logoAnsd = donnees.logoAnsdDataUrl
    ? `<img src="${donnees.logoAnsdDataUrl}" alt="" style="height:9mm;width:auto;display:block;">`
    : "<span></span>";

  return `<div style="width:100%;box-sizing:border-box;padding:0 ${MARGES.gauche} 2mm;font-family:'Helvetica Neue',Arial,sans-serif;font-size:7.5pt;color:#8a97a3;display:flex;align-items:flex-end;justify-content:space-between;gap:6mm;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
  <span style="white-space:nowrap;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  <span style="text-align:center;">${escapeHtml(donnees.editionName)} · Document généré le ${dateLongue.format(new Date())}</span>
  ${logoAnsd}
</div>`;
}

export async function renderListePresence(donnees: DonneesListe): Promise<Buffer> {
  const [forum, ansd] = await Promise.all([logoForumDataUrl(), logoAnsdDataUrl()]);
  const avecLogos = { ...donnees, logoForumDataUrl: forum, logoAnsdDataUrl: ansd };
  return renderHtmlToPdf(listePresenceHtml(avecLogos), {
    format: "A4",
    marges: MARGES,
    piedDePage: piedDePageHtml(avecLogos),
  });
}
