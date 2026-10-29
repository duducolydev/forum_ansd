import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import puppeteer from "puppeteer-core";
import { resolveBrowserPath } from "../src/lib/pdf";

/**
 * Icônes de l'application Scanner (PLAN.md §16.7) et, depuis le 29 octobre
 * 2026, du site lui-même : onglet du navigateur (`favicon.ico`, `icon.png`) et
 * écran d'accueil iOS (`apple-icon.png`). L'onglet montrait le triangle de
 * Next.js, l'icône livrée avec le gabarit de départ.
 *
 * Depuis le 26 octobre 2026 : l'emblème du logo du Forum — le globe et ses
 * barres —, entouré de l'anneau tricolore qui tourne autour de lui dans
 * l'en-tête du site, sur le bleu clair de cet en-tête. C'est la capture qu'en a
 * envoyée le comité, **reconstituée** en haute définition : telle quelle, elle
 * ne pouvait pas servir, l'anneau y étant coupé au bord droit et un morceau de
 * la bande du drapeau y dépassant.
 *
 * Le dessin passe par le Chromium qui rend déjà les badges (`puppeteer-core`,
 * `PUPPETEER_EXECUTABLE_PATH`) : `sharp` n'est pas installé, et un canevas sait
 * redimensionner une image et tracer un dégradé conique. Relancer ce script
 * (`pnpm icones`) régénère les icônes à l'identique.
 */

/** Logo de l'en-tête (`components/site/logo-forum.tsx`). */
const LOGO = join(process.cwd(), "public", "images", "logo-forum-2026.webp");
const LOGO_HAUTEUR = 793;
/** L'emblème tient dans les 600 premières colonnes : au-delà, le texte et la bande du drapeau. */
const EMBLEME_LARGEUR = 601;

/**
 * L'anneau tel que l'en-tête le pose sur le logo (`site-header.tsx`, classe
 * `.anneau-globe` de `constellation.css`) : un carré de 40,5 % de la largeur du
 * logo, décalé de −3,6 % de cette largeur et de 15 % de la hauteur, trait de
 * 2 px pour un logo affiché à 80 px de haut. Les mêmes valeurs, en pixels du
 * fichier du logo (1 800 × 793).
 */
const ANNEAU = {
  gauche: -0.036 * 1800,
  haut: 0.15 * LOGO_HAUTEUR,
  diametre: 0.405 * 1800,
  trait: 2 * (LOGO_HAUTEUR / 80),
  /** L'anneau tourne sur le site ; l'icône le fige dans la position de la capture. */
  rotationDeg: 205,
  /** `--green`, `--gold`, `--red` de `constellation.css`. */
  couleurs: ["#2f8a3e", "#e8b931", "#d64541"],
};

/** Boîte de l'emblème anneau compris : des barres (en haut) au bas de l'anneau. */
const BOITE = {
  x0: ANNEAU.gauche,
  y0: 0,
  largeur: ANNEAU.diametre,
  hauteur: ANNEAU.haut + ANNEAU.diametre,
};

/** Bleu clair de l'en-tête, relevé sur la capture. */
const FOND = "#e2eef9";

interface Gabarit {
  /** Chemin depuis la racine du projet. */
  fichier: string;
  cote: number;
  /** Rayon des coins du fond, en fraction du côté ; 0 = fond plein bord, opaque. */
  rayonFond: number;
  /** Hauteur de l'emblème, en fraction du côté de l'icône. */
  contenu: number;
}

const GABARITS: readonly Gabarit[] = [
  { fichier: "public/icons/scan-192.png", cote: 192, rayonFond: 0.22, contenu: 0.8 },
  { fichier: "public/icons/scan-512.png", cote: 512, rayonFond: 0.22, contenu: 0.8 },
  /*
   * Android découpe l'icône « maskable » en cercle, en goutte ou en carré selon
   * l'appareil : fond plein bord, et contenu dans la zone sûre, un cercle de 80 %
   * du côté. À 60 % de haut, la demi-diagonale de l'emblème vaut 39,5 %.
   */
  { fichier: "public/icons/scan-maskable-512.png", cote: 512, rayonFond: 0, contenu: 0.6 },
  /*
   * iOS arrondit lui-même les coins et remplit la transparence en noir : fond
   * opaque, plein bord.
   */
  { fichier: "public/icons/scan-apple-180.png", cote: 180, rayonFond: 0, contenu: 0.76 },
  /*
   * Site : Next sert d'office `src/app/icon.png` et `src/app/apple-icon.png`
   * et les déclare dans l'en-tête de chaque page.
   */
  { fichier: "src/app/icon.png", cote: 192, rayonFond: 0.22, contenu: 0.8 },
  { fichier: "src/app/apple-icon.png", cote: 180, rayonFond: 0, contenu: 0.76 },
];

/**
 * `favicon.ico`, que les navigateurs demandent d'office à la racine : trois
 * tailles d'onglet dans un seul fichier. L'emblème y est un peu plus grand —
 * à 16 px, chaque pixel de marge compte.
 */
const FAVICON = {
  fichier: "src/app/favicon.ico",
  cotes: [16, 32, 48],
  rayonFond: 0.22,
  contenu: 0.9,
};

type ParametresRendu = Gabarit & {
  fond: string;
  anneau: typeof ANNEAU;
  boite: typeof BOITE;
  emblemeLargeur: number;
  logoHauteur: number;
};

/**
 * Dessin d'une icône, exécuté **dans la page** : rendu à quatre fois la taille
 * puis réduit, pour l'anticrénelage. Renvoie les pixels RGBA en base64.
 */
function dessiner(p: ParametresRendu): string {
  const SURECHANTILLONNAGE = 4;
  const taille = p.cote * SURECHANTILLONNAGE;
  const grand = document.createElement("canvas");
  grand.width = taille;
  grand.height = taille;
  const c = grand.getContext("2d")!;
  c.imageSmoothingQuality = "high";

  c.fillStyle = p.fond;
  c.beginPath();
  c.roundRect(0, 0, taille, taille, p.rayonFond * taille);
  c.fill();

  // Emblème centré, à la hauteur demandée.
  const echelle = (p.contenu * taille) / Math.max(p.boite.largeur, p.boite.hauteur);
  c.translate(
    (taille - p.boite.largeur * echelle) / 2 - p.boite.x0 * echelle,
    (taille - p.boite.hauteur * echelle) / 2 - p.boite.y0 * echelle,
  );
  c.scale(echelle, echelle);
  const logo = document.getElementById("logo") as HTMLImageElement;
  c.drawImage(logo, 0, 0, p.emblemeLargeur, p.logoHauteur, 0, 0, p.emblemeLargeur, p.logoHauteur);

  // Anneau : le dégradé conique CSS part du haut, celui du canevas de la droite.
  const rayon = p.anneau.diametre / 2;
  const cx = p.anneau.gauche + rayon;
  const cy = p.anneau.haut + rayon;
  const degrade = c.createConicGradient(((p.anneau.rotationDeg - 90) * Math.PI) / 180, cx, cy);
  const [vert, or, rouge] = p.anneau.couleurs;
  degrade.addColorStop(0, vert!);
  degrade.addColorStop(1 / 3, or!);
  degrade.addColorStop(2 / 3, rouge!);
  degrade.addColorStop(1, vert!);
  c.strokeStyle = degrade;
  c.lineWidth = p.anneau.trait;
  c.beginPath();
  c.arc(cx, cy, rayon - p.anneau.trait / 2, 0, 2 * Math.PI);
  c.stroke();

  const final = document.createElement("canvas");
  final.width = p.cote;
  final.height = p.cote;
  const f = final.getContext("2d")!;
  f.imageSmoothingQuality = "high";
  f.drawImage(grand, 0, 0, p.cote, p.cote);
  const { data } = f.getImageData(0, 0, p.cote, p.cote);

  let binaire = "";
  for (let i = 0; i < data.length; i += 0x8000) {
    binaire += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(donnees: Buffer): number {
  let c = 0xffffffff;
  for (const octet of donnees) c = TABLE_CRC[(c ^ octet) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloc(type: string, donnees: Buffer): Buffer {
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length);
  const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
  const controle = Buffer.alloc(4);
  controle.writeUInt32BE(crc32(corps));
  return Buffer.concat([longueur, corps, controle]);
}

/**
 * Fichier ICO fait d'images PNG, ce que lisent tous les navigateurs actuels :
 * un en-tête, une entrée de 16 octets par taille, puis les PNG à la suite.
 */
function encoderIco(images: { cote: number; png: Buffer }[]): Buffer {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0);
  entete.writeUInt16LE(1, 2); // icône
  entete.writeUInt16LE(images.length, 4);

  let decalage = 6 + 16 * images.length;
  const entrees = images.map(({ cote, png }) => {
    const entree = Buffer.alloc(16);
    entree[0] = cote >= 256 ? 0 : cote;
    entree[1] = cote >= 256 ? 0 : cote;
    entree.writeUInt16LE(1, 4); // plans
    entree.writeUInt16LE(32, 6); // bits par pixel
    entree.writeUInt32LE(png.length, 8);
    entree.writeUInt32LE(decalage, 12);
    decalage += png.length;
    return entree;
  });

  return Buffer.concat([entete, ...entrees, ...images.map(({ png }) => png)]);
}

/** PNG en couleurs vraies, avec canal alpha seulement si l'icône en a besoin. */
function encoderPng(cote: number, rgba: Buffer, avecAlpha: boolean): Buffer {
  const canaux = avecAlpha ? 4 : 3;
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(cote, 0);
  entete.writeUInt32BE(cote, 4);
  entete[8] = 8;
  entete[9] = avecAlpha ? 6 : 2;

  const lignes = Buffer.alloc(cote * (1 + cote * canaux));
  for (let y = 0; y < cote; y++) {
    const debut = y * (1 + cote * canaux);
    lignes[debut] = 0; // aucun filtre
    for (let x = 0; x < cote; x++) {
      const source = (y * cote + x) * 4;
      const cible = debut + 1 + x * canaux;
      for (let canal = 0; canal < canaux; canal++) lignes[cible + canal] = rgba[source + canal]!;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", entete),
    bloc("IDAT", deflateSync(lignes, { level: 9 })),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

async function main(): Promise<void> {
  const executablePath = resolveBrowserPath();
  if (!executablePath) {
    console.error("Aucun navigateur trouvé — définir PUPPETEER_EXECUTABLE_PATH.");
    process.exit(1);
  }

  const navigateur = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const page = await navigateur.newPage();
    const logo = `data:image/webp;base64,${readFileSync(LOGO).toString("base64")}`;
    await page.setContent(`<img id="logo" src="${logo}" alt="" />`, { waitUntil: "load" });

    const rendre = async (gabarit: Gabarit): Promise<Buffer> => {
      const rgba = Buffer.from(
        await page.evaluate(dessiner, {
          ...gabarit,
          fond: FOND,
          anneau: ANNEAU,
          boite: BOITE,
          emblemeLargeur: EMBLEME_LARGEUR,
          logoHauteur: LOGO_HAUTEUR,
        }),
        "base64",
      );
      return encoderPng(gabarit.cote, rgba, gabarit.rayonFond > 0);
    };

    for (const gabarit of GABARITS) {
      const png = await rendre(gabarit);
      const chemin = join(process.cwd(), gabarit.fichier);
      mkdirSync(dirname(chemin), { recursive: true });
      writeFileSync(chemin, png);
      console.log(`${gabarit.fichier} : ${gabarit.cote} px, ${png.length} octets`);
    }

    const images = [];
    for (const cote of FAVICON.cotes) {
      images.push({ cote, png: await rendre({ ...FAVICON, cote }) });
    }
    const ico = encoderIco(images);
    writeFileSync(join(process.cwd(), FAVICON.fichier), ico);
    console.log(`${FAVICON.fichier} : ${FAVICON.cotes.join(", ")} px, ${ico.length} octets`);
  } finally {
    await navigateur.close();
  }
}

void main();
