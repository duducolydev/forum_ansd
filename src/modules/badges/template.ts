/**
 * Gabarit du badge (brief §5.4, reprise de `.badge` du template visuel).
 *
 * Le HTML est **autonome** : CSS en ligne, QR et photo en `data:` URI, aucune
 * ressource distante. Le rendu Puppeteer n'attend donc aucun réseau, ce qui
 * est indispensable pour tenir la cible de 500 badges en moins de 5 minutes.
 *
 * Le badge reste toujours en thème clair : il est imprimé.
 */
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

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 53.98mm; height: 85.6mm;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    background: #fff; color: ${ANSD_BLEU_NUIT};
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  /* overflow:hidden fait office de garde-fou : un nom très long ne doit
     jamais pousser le QR ou l'identifiant hors de la carte imprimée. */
  .badge {
    width: 53.98mm; height: 85.6mm; overflow: hidden;
    display: flex; flex-direction: column; background: #fff;
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
    border-bottom: 0.2mm solid #dbe7f3;
    padding: 2mm 3mm; line-height: 1.2;
    display: flex; align-items: center; gap: 2mm;
  }
  /* Hauteur fixe, largeur libre : le rapport du logo est conservé, et une
     future version plus large ne déformera pas l'en-tête. */
  .top .logo { flex: 0 0 auto; height: 7mm; width: auto; display: block; }
  .top .titres { min-width: 0; flex: 1 1 auto; }
  /* Deux lignes au maximum, puis coupure : un titre d'édition très long ne
     doit jamais pousser la photo ou le QR hors de la carte imprimée. */
  .top .evenement {
    font-size: 5.4pt; font-weight: 800; letter-spacing: 0.02em;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .top .dates { font-size: 4.8pt; color: #4e6a88; margin-top: 0.3mm; }
  .band {
    flex: 0 0 auto; height: 2mm;
    background: linear-gradient(90deg, ${ANSD_BLEU_VIF}, ${accent});
  }
  /* Identité : occupe la place restante et se centre dedans. */
  .body {
    flex: 1 1 auto; min-height: 0; overflow: hidden;
    padding: 3mm 3mm 1.5mm;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; text-align: center; gap: 0.8mm;
  }
  /* Pied de carte : hauteur fixe, jamais comprimé — c'est lui qui porte le QR
     et l'identifiant, les deux éléments qui doivent toujours rester lisibles. */
  .foot {
    flex: 0 0 auto; padding: 0 3mm 2.5mm;
    display: flex; flex-direction: column; align-items: center; gap: 1.2mm;
  }
  .photo {
    flex: 0 0 auto; width: 17mm; height: 17mm; border-radius: 50%; object-fit: cover;
    border: 0.5mm solid ${accent}; background: #eef4fa;
  }
  .photo.initials {
    display: flex; align-items: center; justify-content: center;
    font-size: 13pt; font-weight: 700; color: ${ANSD_BLEU_NUIT};
  }
  .name {
    margin-top: 1.5mm; font-size: 11pt; font-weight: 800; line-height: 1.1;
    color: ${ANSD_BLEU_NUIT}; word-break: break-word;
  }
  .name .last { text-transform: uppercase; }
  .job, .org { font-size: 6pt; color: #4e6a88; line-height: 1.25; }
  .pill {
    display: inline-block; padding: 0.8mm 2.2mm; border-radius: 99px;
    background: ${accent}22; color: ${accent}; font-size: 5.6pt; font-weight: 700;
    border: 0.2mm solid ${accent}55;
  }
  .qr { width: 17mm; height: 17mm; display: block; }
  .uid { font-size: 5.8pt; color: #7a8fa6; letter-spacing: 0.1em; font-weight: 600; }
</style>
</head>
<body>
  <div class="badge" data-capture>
    <div class="top">
      ${data.logoDataUrl ? `<img class="logo" src="${data.logoDataUrl}" alt="" />` : ""}
      <div class="titres">
        <div class="evenement">${escapeHtml(data.editionName)}</div>
        ${data.eventDates ? `<div class="dates">${escapeHtml(data.eventDates)}</div>` : ""}
      </div>
    </div>
    <div class="band"></div>
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
</body>
</html>`;
}
