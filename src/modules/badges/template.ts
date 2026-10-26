/**
 * Gabarit du badge : la maquette de l'infographe (`docs/Maquette_badge.pdf`,
 * 26 octobre 2026), reconstituée en HTML.
 *
 * Le HTML est **autonome** : CSS en ligne, polices, logo, QR et photo en
 * `data:` URI, fond dessiné en SVG. Le rendu Puppeteer n'attend donc aucun
 * réseau, ce qui est indispensable pour tenir la cible de 500 badges en moins
 * de 5 minutes.
 *
 * Format : 100 × 150 mm, portrait, fente pour cordon en tête (`format.ts`). Les
 * cotes sont celles de la maquette, relevées sur son rendu à 300 ppp.
 */
import { BLANC, ratioContraste, texteSur } from "@/modules/settings/regles";
import { FENTE_CORDON, FORMAT_BADGE } from "./format";

export interface BadgeTemplateData {
  editionName: string;
  /** Logo du Forum en `data:` URI (`modules/badges/logo.ts`), ou `null`. */
  logoDataUrl?: string | null;
  /** Règles `@font-face` des polices du badge (`modules/badges/polices.ts`). */
  policesCss?: string | null;
  /** Dates du Forum, déjà mises en forme : « 23–25 novembre 2026 ». */
  eventDates?: string | null;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  organization: string | null;
  categoryLabel: string;
  /** Couleur de la catégorie : bandeau, cadre de la photo et du QR. */
  categoryColor: string | null;
  /**
   * Mention portée par le bandeau à la place du libellé de la catégorie
   * (`mention.ts`) : « ACCRÉDITATION PRESSE », « COMITÉ D'ORGANISATION »…
   */
  mention?: string | null;
  publicId: string;
  qrDataUrl: string;
  photoDataUrl: string | null;
}

const VERT_PAR_DEFAUT = "#3dbb6e";
const ENCRE = "#231f20";

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

/**
 * Libellé du bandeau sur deux lignes, comme « Personnel / ANSD » dans la
 * maquette : la coupure qui équilibre le mieux les deux lignes. La seconde
 * s'imprime en gras. Un seul mot tient sur une ligne, en gras.
 */
export function libelleEnDeuxLignes(libelle: string): string[] {
  const mots = libelle.trim().split(/\s+/);
  if (mots.length < 2) return [mots.join(" ")];
  let coupure = 1;
  let plusLongue = Number.POSITIVE_INFINITY;
  for (let i = 1; i < mots.length; i++) {
    const longueur = Math.max(mots.slice(0, i).join(" ").length, mots.slice(i).join(" ").length);
    if (longueur < plusLongue) {
      plusLongue = longueur;
      coupure = i;
    }
  }
  return [mots.slice(0, coupure).join(" "), mots.slice(coupure).join(" ")];
}

/** Générateur à graine fixe (mulberry32) : la constellation est la même sur tous les badges. */
function hasardFixe(graine: number): () => number {
  return () => {
    graine = (graine + 0x6d2b79f5) | 0;
    let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Réseau de points et de traits du fond de la maquette, dans les deux zones
 * claires (en millimètres). Calculé une fois au chargement du module.
 */
function constellation(): string {
  const hasard = hasardFixe(2026);
  const noeuds: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 18; i++)
    noeuds.push({ x: hasard() * 100, y: hasard() * 50, r: 0.5 + hasard() * 1.4 });
  for (let i = 0; i < 16; i++)
    noeuds.push({ x: hasard() * 100, y: 92 + hasard() * 58, r: 0.5 + hasard() * 1.4 });

  const traits: string[] = [];
  for (const [i, noeud] of noeuds.entries()) {
    const voisins = noeuds
      .map((autre, j) => ({ j, d: Math.hypot(autre.x - noeud.x, autre.y - noeud.y) }))
      .filter(({ j, d }) => j > i && d < 24)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { j } of voisins) {
      const autre = noeuds[j]!;
      traits.push(
        `<line x1="${noeud.x.toFixed(2)}" y1="${noeud.y.toFixed(2)}" x2="${autre.x.toFixed(2)}" y2="${autre.y.toFixed(2)}"/>`,
      );
    }
  }

  // Un nœud sur trois en hexagone, comme dans la maquette.
  const formes = noeuds.map(({ x, y, r }, i) => {
    if (i % 3 !== 0)
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}"/>`;
    const sommets = Array.from({ length: 6 }, (_, k) => {
      const angle = (Math.PI / 3) * k + Math.PI / 6;
      return `${(x + r * Math.cos(angle)).toFixed(2)},${(y + r * Math.sin(angle)).toFixed(2)}`;
    });
    return `<polygon points="${sommets.join(" ")}"/>`;
  });

  return `<g stroke="#7f95b3" stroke-opacity="0.3" stroke-width="0.14">${traits.join("")}</g><g fill="#8fa6c2" fill-opacity="0.32">${formes.join("")}</g>`;
}

const CONSTELLATION = constellation();

/*
 * Bande bleue de la maquette : ce qui reste entre deux grands cercles, l'un
 * centré au-dessus du badge, l'autre en dessous (relevés sur la maquette :
 * centre (50 ; −13) mm et rayon 75,3 ; centre (50 ; 158,7) mm et rayon 73,7).
 * Bleu soutenu sur les bords, plus clair au centre, rayé de pointillés fins.
 */
const FOND = `
<svg class="decor" viewBox="0 0 100 150" aria-hidden="true">
  <defs>
    <linearGradient id="bande" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stop-color="#2f4999"/>
      <stop offset="0.12" stop-color="#3d5ba4"/>
      <stop offset="0.22" stop-color="#496cae"/>
      <stop offset="0.31" stop-color="#5a86bb"/>
      <stop offset="0.5" stop-color="#6e9fcd"/>
      <stop offset="0.69" stop-color="#5a86bb"/>
      <stop offset="0.78" stop-color="#496cae"/>
      <stop offset="0.88" stop-color="#3d5ba4"/>
      <stop offset="1" stop-color="#2f4999"/>
    </linearGradient>
    <!-- Rayures fines : un dégradé répété plutôt qu'un motif, que le moteur
         poserait tuile par tuile — 300 ms de plus par badge, mesurés. -->
    <linearGradient id="trame" x1="0" y1="0" x2="0" y2="0.85" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
      <stop offset="0.4" stop-color="#a9dcec" stop-opacity="0"/>
      <stop offset="0.4" stop-color="#a9dcec" stop-opacity="0.16"/>
      <stop offset="0.53" stop-color="#a9dcec" stop-opacity="0.16"/>
      <stop offset="0.53" stop-color="#a9dcec" stop-opacity="0"/>
    </linearGradient>
    <mask id="entre-les-cercles">
      <rect width="100" height="150" fill="#fff"/>
      <circle cx="50" cy="-13" r="75.3" fill="#000"/>
      <circle cx="50" cy="158.7" r="73.7" fill="#000"/>
    </mask>
  </defs>
  <g fill="#fff" fill-opacity="0.08">
    <rect x="2" y="22" width="24" height="34"/>
    <rect x="72" y="6" width="22" height="44"/>
  </g>
  ${CONSTELLATION}
  <g mask="url(#entre-les-cercles)">
    <rect width="100" height="150" fill="url(#bande)"/>
    <rect width="100" height="150" fill="url(#trame)"/>
  </g>
  <g fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="0.22" stroke-dasharray="0.45 0.35">
    <circle cx="50" cy="-13" r="75.3"/>
    <circle cx="50" cy="158.7" r="73.7"/>
  </g>
</svg>`;

/*
 * Ajustement des textes longs, une fois les polices chargées : chaque texte
 * tient en deux lignes au plus, quitte à réduire sa taille ; puis le bloc
 * d'identité tient dans sa zone, et chaque ligne du bandeau dans sa largeur.
 * Par pas de 5 %, jusqu'à 55 % de la taille d'origine au plus. Le rendu
 * attend la promesse `window.__pret` (`lib/pdf.ts`).
 */
const AJUSTEMENT = `
(function () {
  function taille(el) { return parseFloat(getComputedStyle(el).fontSize); }
  function reduire(els, deborde) {
    var depart = els.map(taille);
    for (var pas = 1; deborde() && pas <= 12; pas++) {
      els.forEach(function (el, i) { el.style.fontSize = depart[i] * Math.pow(0.95, pas) + "px"; });
    }
  }
  function ajuster() {
    document.querySelectorAll("[data-deux-lignes]").forEach(function (el) {
      reduire([el], function () {
        return el.scrollHeight > parseFloat(getComputedStyle(el).lineHeight) * 2 + 1 ||
          el.scrollWidth > el.clientWidth + 1;
      });
    });
    var identite = document.querySelector(".identite");
    if (identite) {
      reduire(Array.prototype.slice.call(identite.children), function () {
        return identite.scrollHeight > identite.clientHeight + 1;
      });
    }
    var bandeau = document.querySelector(".bandeau");
    if (bandeau) {
      var lignes = Array.prototype.slice.call(bandeau.children);
      reduire(lignes, function () {
        return bandeau.scrollHeight > bandeau.clientHeight + 1 || lignes.some(function (l) {
          return l.scrollWidth > l.clientWidth + 1;
        });
      });
    }
  }
  window.__pret = Promise.all([
    document.fonts.load('800 18pt "Roboto"'),
    document.fonts.load('700 13pt "Baloo Thambi 2"'),
  ]).then(ajuster, ajuster);
})();`;

export function renderBadgeHtml(data: BadgeTemplateData): string {
  const accent = data.categoryColor ?? VERT_PAR_DEFAUT;
  /*
   * Texte blanc sur la couleur de la catégorie, comme dans la maquette, dès
   * qu'il s'y lit — il est grand et gras ; l'encre sombre sur les couleurs
   * claires (or, jaune), où le blanc disparaîtrait.
   */
  const encreAccent = ratioContraste(accent, BLANC) >= 2 ? BLANC : texteSur(accent);
  const largeur = `${FORMAT_BADGE.largeurMm}mm`;
  const hauteur = `${FORMAT_BADGE.hauteurMm}mm`;

  const photo = data.photoDataUrl
    ? `<div class="photo"><img src="${data.photoDataUrl}" alt="" /></div>`
    : `<div class="photo initiales">${escapeHtml(initials(data.firstName, data.lastName))}</div>`;

  const entete = data.logoDataUrl
    ? `<img class="logo" src="${data.logoDataUrl}" alt="" />`
    : `<div class="logo titre">${escapeHtml(data.editionName)}</div>`;

  const lignesBandeau = libelleEnDeuxLignes(data.mention ?? data.categoryLabel)
    .map((ligne, i, toutes) => {
      const classe = i === toutes.length - 1 ? "fort" : "leger";
      return `<span class="${classe}">${escapeHtml(ligne)}</span>`;
    })
    .join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  ${data.policesCss ?? ""}
  @page { margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${largeur}; height: ${hauteur};
    font-family: "Roboto", "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: ${ENCRE};
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .badge {
    position: relative; width: ${largeur}; height: ${hauteur}; overflow: hidden;
    background: linear-gradient(180deg,
      #c7ced8 0%, #d4dae3 20%, #d0d9e2 30%, #b4cbdc 64%,
      #a9c4d8 73%, #86b0cf 93%, #83b1d1 100%);
  }
  .decor { position: absolute; inset: 0; width: ${largeur}; height: ${hauteur}; }
  /* Repère de la fente pour cordon, dans le gris de la maquette. */
  .fente {
    position: absolute; top: ${FENTE_CORDON.depuisLeHautMm}mm; left: 50%;
    width: ${FENTE_CORDON.largeurMm}mm; height: ${FENTE_CORDON.hauteurMm}mm;
    margin-left: -${FENTE_CORDON.largeurMm / 2}mm;
    border-radius: ${FENTE_CORDON.hauteurMm / 2}mm; background: #a7a5a6;
  }
  .logo { position: absolute; left: 12.5mm; top: 10mm; width: 75mm; height: auto; }
  .logo.titre {
    height: 33mm; display: flex; align-items: center; justify-content: center;
    text-align: center; font-size: 18pt; font-weight: 800; color: #1d5db2;
  }
  .dates {
    position: absolute; left: 0; right: 0; top: 45.4mm; text-align: center;
    font-family: "Baloo Thambi 2", "Roboto", sans-serif; font-weight: 700;
    font-size: 13pt; line-height: 1.2; color: #1d5db2;
  }
  .photo {
    position: absolute; left: 34.7mm; top: 55.1mm; width: 30.6mm; height: 39.1mm;
    border: 1.2mm solid ${accent}; background: #fff; overflow: hidden;
    box-shadow: 0 0 4mm 0.6mm rgba(8, 48, 72, 0.4);
  }
  .photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
  /* Sans photo : les initiales, sur la couleur de la catégorie. */
  .photo.initiales {
    display: flex; align-items: center; justify-content: center;
    background: ${accent}; border-color: color-mix(in srgb, ${accent} 78%, #000);
    color: ${encreAccent}; font-size: 34pt; font-weight: 700; letter-spacing: 0.02em;
  }
  /* Nom, fonction, organisation : centrés entre la photo et le QR. */
  .identite {
    position: absolute; left: 6mm; right: 6mm; top: 95.6mm; height: 19.6mm;
    display: flex; flex-direction: column; align-items: center;
    justify-content: safe center; gap: 0.7mm; text-align: center; overflow: hidden;
  }
  .identite > * {
    flex-shrink: 0; max-width: 100%;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .nom { font-size: 18.5pt; font-weight: 900; line-height: 1.1; }
  /* Nom de famille d'un seul tenant : « NDIAYE-MBENGUE » ne se coupe pas. */
  .nom .last { text-transform: uppercase; white-space: nowrap; }
  .fonction { font-size: 13pt; font-weight: 600; line-height: 1.15; }
  .organisation { font-size: 10pt; font-weight: 400; line-height: 1.2; color: #33414f; }
  .qr {
    position: absolute; left: 6.1mm; top: 116.3mm; width: 23.7mm; height: 23.7mm;
    background: #fff; border: 0.35mm solid ${accent}; padding: 0.9mm;
  }
  .qr img { display: block; width: 100%; height: 100%; }
  .uid {
    position: absolute; left: 1mm; width: 33.9mm; top: 141.1mm; text-align: center;
    font-size: 9.5pt; font-weight: 700; line-height: 1.2;
  }
  /* Bandeau de la catégorie, jusqu'au bord droit : la mention, sinon le libellé. */
  .bandeau {
    position: absolute; left: 32.5mm; right: 0; top: 119.6mm; height: 17.6mm;
    padding: 0 3mm 0 3.4mm; overflow: hidden;
    display: flex; flex-direction: column; justify-content: center;
    background: linear-gradient(100deg,
      color-mix(in srgb, ${accent} 88%, #000), color-mix(in srgb, ${accent} 88%, #fff));
    color: ${encreAccent};
  }
  .bandeau > span { display: block; white-space: nowrap; overflow: hidden; line-height: 1.04; }
  .bandeau .leger { font-size: 20pt; font-weight: 500; }
  .bandeau .fort { font-size: 22pt; font-weight: 700; }
</style>
</head>
<body>
  <div class="badge" data-capture>
    ${FOND}
    <div class="fente"></div>
    ${entete}
    ${data.eventDates ? `<div class="dates">${escapeHtml(data.eventDates)}</div>` : ""}
    ${photo}
    <div class="identite">
      <div class="nom" data-deux-lignes>${escapeHtml(data.firstName)} <span class="last">${escapeHtml(data.lastName)}</span></div>
      ${data.jobTitle ? `<div class="fonction" data-deux-lignes>${escapeHtml(data.jobTitle)}</div>` : ""}
      ${data.organization ? `<div class="organisation" data-deux-lignes>${escapeHtml(data.organization)}</div>` : ""}
    </div>
    <div class="qr"><img src="${data.qrDataUrl}" alt="" /></div>
    <div class="uid">${escapeHtml(data.publicId)}</div>
    <div class="bandeau">${lignesBandeau}</div>
  </div>
  <script>${AJUSTEMENT}</script>
</body>
</html>`;
}
