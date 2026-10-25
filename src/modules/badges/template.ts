/**
 * Gabarit du badge (brief §5.4, reprise de `.badge` du template visuel).
 *
 * Le HTML est **autonome** : CSS en ligne, QR et photo en `data:` URI, aucune
 * ressource distante. Le rendu Puppeteer n'attend donc aucun réseau, ce qui
 * est indispensable pour tenir la cible de 500 badges en moins de 5 minutes.
 *
 * Le badge reste toujours en thème clair : il est imprimé.
 *
 * Format : 100 × 150 mm, portrait, fente pour cordon en tête (`format.ts`).
 */
import { texteSur } from "@/modules/settings/regles";
import { FENTE_CORDON, FORMAT_BADGE } from "./format";
export interface BadgeTemplateData {
  editionName: string;
  /** Logo du Forum en `data:` URI (`modules/badges/logo.ts`), ou `null`. */
  logoDataUrl?: string | null;
  /** Dates du Forum, déjà mises en forme : « 23–25 novembre 2026 ». */
  eventDates?: string | null;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  organization: string | null;
  country: string;
  categoryLabel: string;
  /** Couleur de la catégorie (`ParticipantCategory.color`), pour le bandeau et la pastille. */
  categoryColor: string | null;
  /**
   * Mention imprimée en bande sous l'en-tête — « ACCRÉDITATION PRESSE » pour un
   * journaliste accrédité (29 septembre 2026). Absente pour les autres.
   */
  mention?: string | null;
  /**
   * Mention propre à la catégorie (24 octobre 2026) : bande pleine à la couleur
   * de la catégorie, texte blanc ou encre selon le contraste. Sans elle, la
   * bande bleu nuit d'origine (presse).
   */
  mentionEnCouleur?: boolean;
  publicId: string;
  qrDataUrl: string;
  photoDataUrl: string | null;
}

const ANSD_BLEU_NUIT = "#082c4e";
const ANSD_BLEU_VIF = "#2f7fd1";
const ANSD_VERT_VIF = "#3dbb6e";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function renderBadgeHtml(data: BadgeTemplateData): string {
  const accent = data.categoryColor ?? ANSD_VERT_VIF;
  const subtitle = [data.organization, data.country]
    .filter((value): value is string => Boolean(value))
    .map(escapeHtml)
    .join(" · ");

  const avatar = data.photoDataUrl
    ? `<img class="photo" src="${data.photoDataUrl}" alt="" />`
    : `<div class="photo initials">${escapeHtml(initials(data.firstName, data.lastName))}</div>`;

  const largeur = `${FORMAT_BADGE.largeurMm}mm`;
  const hauteur = `${FORMAT_BADGE.hauteurMm}mm`;
  // Le contenu de l'en-tête commence 3 mm sous la fente : rien n'est perforé.
  const sousLaFente = FENTE_CORDON.depuisLeHautMm + FENTE_CORDON.hauteurMm + 3;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${largeur}; height: ${hauteur};
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    background: #fff; color: ${ANSD_BLEU_NUIT};
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* overflow:hidden fait office de garde-fou : un nom très long ne doit
     jamais pousser le QR ou l'identifiant hors de la carte imprimée. */
  .badge {
    position: relative;
    width: ${largeur}; height: ${hauteur}; overflow: hidden;
    display: flex; flex-direction: column; background: #fff;
  }
  /* Repère de la fente pour cordon : un contour discret, à l'endroit exact
     de la perforation. Sur un badge percé, il disparaît avec la découpe. */
  .fente {
    position: absolute; top: ${FENTE_CORDON.depuisLeHautMm}mm; left: 50%;
    width: ${FENTE_CORDON.largeurMm}mm; height: ${FENTE_CORDON.hauteurMm}mm;
    margin-left: -${FENTE_CORDON.largeurMm / 2}mm;
    border: 0.3mm solid #b9cbe0; border-radius: ${FENTE_CORDON.hauteurMm / 2}mm;
    background: #fff;
  }
  /* flex:0 0 auto sur les blocs fixes — sans cela, un titre d'édition qui
     passe sur deux lignes fait déborder la colonne et Chromium écrase les
     enfants « fins » : le bandeau de couleur disparaissait du rendu. */
  /*
   * En-tête sur fond **clair**, et non sur le bleu nuit d'origine : le logo du
   * Forum porte son texte en bleu nuit, qui disparaîtrait sur un fond de la
   * même couleur. C'est la raison qui garde aussi la barre du site public en
   * fond clair.
   */
  .top {
    flex: 0 0 auto;
    background: #f2f7fc; color: ${ANSD_BLEU_NUIT};
    border-bottom: 0.3mm solid #dbe7f3;
    padding: ${sousLaFente}mm 6mm 3mm; line-height: 1.2;
    display: flex; align-items: center; gap: 3.5mm;
  }
  /* Hauteur fixe, largeur libre : le rapport du logo est conservé, et une
     future version plus large ne déformera pas l'en-tête. */
  .top .logo { flex: 0 0 auto; height: 12mm; width: auto; display: block; }
  .top .titres { min-width: 0; flex: 1 1 auto; }
  /* Deux lignes au maximum, puis coupure : un titre d'édition très long ne
     doit jamais pousser la photo ou le QR hors du badge imprimé. */
  .top .evenement {
    font-size: 10pt; font-weight: 800; letter-spacing: 0.02em;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .top .dates { font-size: 8.5pt; color: #4e6a88; margin-top: 0.6mm; }
  .band {
    flex: 0 0 auto; height: 3mm;
    background: linear-gradient(90deg, ${ANSD_BLEU_VIF}, ${accent});
  }
  /* Mention d'accréditation : blanc sur bleu nuit, lisible quelle que soit la
     couleur de la catégorie ; le filet de gauche en rappelle la couleur. */
  .mention {
    flex: 0 0 auto; padding: 1.8mm 4mm;
    background: ${ANSD_BLEU_NUIT}; color: #fff; border-left: 2.2mm solid ${accent};
    font-size: 10.5pt; font-weight: 800; letter-spacing: 0.14em; text-align: center;
    text-transform: uppercase;
  }
  /* Mention de catégorie (comité d'organisation…) : la couleur de la catégorie
     en bande pleine, repérable de loin au contrôle ; le texte prend celle des
     deux encres qui contraste le mieux avec elle. */
  .mention.couleur {
    background: ${accent}; color: ${texteSur(accent)}; border-left: 0;
    padding: 2.2mm 4mm; font-size: 11.5pt;
  }
  /* Identité : occupe la place restante et se centre dedans. « safe » : si
     elle déborde malgré l'ajustement, c'est le bas qui est coupé, jamais la
     photo. --e est l'échelle posée par le script d'ajustement, en fin de page. */
  .body {
    --e: 1;
    flex: 1 1 auto; min-height: 0; overflow: hidden;
    padding: 4mm 6mm 3mm;
    display: flex; flex-direction: column; align-items: center;
    justify-content: safe center; text-align: center; gap: calc(1.3mm * var(--e));
  }
  /* Aucune ligne de l'identité ne se laisse comprimer : écrasée par la flexbox,
     une fonction sur deux lignes devenait illisible au lieu de déborder — et
     sans débordement, l'ajustement ne se déclenchait pas. */
  .body > * { flex-shrink: 0; }
  /* Pied de badge : hauteur fixe, jamais comprimé — c'est lui qui porte le QR
     et l'identifiant, les deux éléments qui doivent toujours rester lisibles. */
  .foot {
    flex: 0 0 auto; padding: 0 6mm 5mm;
    display: flex; flex-direction: column; align-items: center; gap: 2mm;
  }
  .photo {
    flex: 0 0 auto; width: calc(26mm * var(--e)); height: calc(26mm * var(--e));
    border-radius: 50%; object-fit: cover;
    border: 0.8mm solid ${accent}; background: #eef4fa;
  }
  .photo.initials {
    display: flex; align-items: center; justify-content: center;
    font-size: calc(20pt * var(--e)); font-weight: 700; color: ${ANSD_BLEU_NUIT};
  }
  .name {
    margin-top: calc(2mm * var(--e)); font-size: calc(18pt * var(--e));
    font-weight: 800; line-height: 1.1;
    color: ${ANSD_BLEU_NUIT}; word-break: break-word;
  }
  .name .last { text-transform: uppercase; }
  /* Deux lignes au plus chacune : une fonction de trois lignes réduirait le
     nom, qui compte davantage au contrôle. */
  .job, .org {
    font-size: calc(10pt * var(--e)); color: #4e6a88; line-height: 1.3;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pill {
    display: inline-block; padding: 1.3mm 4mm; border-radius: 99px;
    background: ${accent}22; color: ${accent}; font-size: 9.5pt; font-weight: 700;
    border: 0.3mm solid ${accent}55;
  }
  .qr { width: 26mm; height: 26mm; display: block; }
  .uid { font-size: 9pt; color: #7a8fa6; letter-spacing: 0.1em; font-weight: 600; }
</style>
</head>
<body>
  <div class="badge" data-capture>
    <div class="fente"></div>
    <div class="top">
      ${data.logoDataUrl ? `<img class="logo" src="${data.logoDataUrl}" alt="" />` : ""}
      <div class="titres">
        <div class="evenement">${escapeHtml(data.editionName)}</div>
        ${data.eventDates ? `<div class="dates">${escapeHtml(data.eventDates)}</div>` : ""}
      </div>
    </div>
    <div class="band"></div>
    ${
      data.mention
        ? `<div class="${data.mentionEnCouleur ? "mention couleur" : "mention"}">${escapeHtml(data.mention)}</div>`
        : ""
    }
    <div class="body">
      ${avatar}
      <div class="name">${escapeHtml(data.firstName)}<br /><span class="last">${escapeHtml(data.lastName)}</span></div>
      ${data.jobTitle ? `<div class="job">${escapeHtml(data.jobTitle)}</div>` : ""}
      ${subtitle ? `<div class="org">${subtitle}</div>` : ""}
    </div>
    <div class="foot">
      <span class="pill">${escapeHtml(data.categoryLabel)}</span>
      <img class="qr" src="${data.qrDataUrl}" alt="" />
      <div class="uid">${escapeHtml(data.publicId)}</div>
    </div>
  </div>
  <script>
    /*
     * Un nom ou une fonction très longs réduisent la photo et le texte de
     * l'identité, par pas de 5 %, jusqu'à tenir dans la place disponible —
     * plutôt que d'être coupés. Les polices étant celles du système, la mise
     * en page est connue dès cet instant, avant le rendu.
     */
    (function () {
      var corps = document.querySelector(".body");
      if (!corps) return;
      for (var echelle = 1; corps.scrollHeight > corps.clientHeight + 1 && echelle > 0.6; ) {
        echelle -= 0.05;
        corps.style.setProperty("--e", String(echelle));
      }
    })();
  </script>
</body>
</html>`;
}
