import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

/**
 * Icônes de l'application Scanner (PLAN.md §16.7).
 *
 * Dessinées d'après la marque du site — le carré bleu nuit aux trois barres de
 * l'en-tête et du menu — plutôt que versionnées sans source : relancer ce script
 * (`pnpm icones:scanner`) les régénère à l'identique.
 *
 * Sans dépendance : `sharp` n'est pas installé, et un moteur de rendu entier
 * pour trois rectangles arrondis serait disproportionné. L'anticrénelage se fait
 * par suréchantillonnage 4 × 4.
 */

type Rgb = readonly [number, number, number];

/** Couleurs de la marque (`globals.css` : --ansd-bleu-nuit, --ansd-vert-vif). */
const BLEU_NUIT: Rgb = [0x08, 0x2c, 0x4e];
const BARRES: readonly { hauteur: number; couleur: Rgb }[] = [
  { hauteur: 0.4, couleur: [0x7f, 0xb3, 0xe6] },
  { hauteur: 0.7, couleur: [0x3d, 0xbb, 0x6e] },
  { hauteur: 1, couleur: [0xff, 0xff, 0xff] },
];

/** Proportions du logo de l'en-tête : boîte de 30 px, colonnes à 3 px d'écart, coins de 2 px. */
const ECART = 3 / 30;
const LARGEUR_BARRE = (1 - 2 * ECART) / 3;
const RAYON_BARRE = 2 / 30;

const SURECHANTILLONNAGE = 4;

interface Gabarit {
  fichier: string;
  cote: number;
  /** Rayon des coins du fond, en fraction du côté ; 0 = fond plein bord, opaque. */
  rayonFond: number;
  /** Côté du groupe de barres, en fraction du côté de l'icône. */
  contenu: number;
}

const GABARITS: readonly Gabarit[] = [
  { fichier: "scan-192.png", cote: 192, rayonFond: 0.22, contenu: 0.6 },
  { fichier: "scan-512.png", cote: 512, rayonFond: 0.22, contenu: 0.6 },
  /*
   * Android découpe l'icône « maskable » en cercle, en goutte ou en carré selon
   * l'appareil : fond plein bord, et contenu dans la zone sûre, un cercle de 80 %
   * du côté. Un carré de 50 % y tient — sa demi-diagonale vaut 35 %.
   */
  { fichier: "scan-maskable-512.png", cote: 512, rayonFond: 0, contenu: 0.5 },
  /*
   * iOS arrondit lui-même les coins et remplit la transparence en noir : fond
   * opaque, plein bord.
   */
  { fichier: "scan-apple-180.png", cote: 180, rayonFond: 0, contenu: 0.58 },
];

function dansRectangleArrondi(
  x: number,
  y: number,
  gauche: number,
  haut: number,
  largeur: number,
  hauteur: number,
  rayon: number,
): boolean {
  if (x < gauche || x > gauche + largeur || y < haut || y > haut + hauteur) return false;
  const r = Math.min(rayon, largeur / 2, hauteur / 2);
  const cx = Math.min(Math.max(x, gauche + r), gauche + largeur - r);
  const cy = Math.min(Math.max(y, haut + r), haut + hauteur - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Couleur au point (x, y) du carré unité, ou `null` hors de l'icône. */
function couleurAu(x: number, y: number, gabarit: Gabarit): Rgb | null {
  if (!dansRectangleArrondi(x, y, 0, 0, 1, 1, gabarit.rayonFond)) return null;

  const origine = (1 - gabarit.contenu) / 2;
  const u = (x - origine) / gabarit.contenu;
  const v = (y - origine) / gabarit.contenu;

  for (const [rang, barre] of BARRES.entries()) {
    const gauche = rang * (LARGEUR_BARRE + ECART);
    if (
      dansRectangleArrondi(
        u,
        v,
        gauche,
        1 - barre.hauteur,
        LARGEUR_BARRE,
        barre.hauteur,
        RAYON_BARRE,
      )
    ) {
      return barre.couleur;
    }
  }
  return BLEU_NUIT;
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

function rendre(gabarit: Gabarit): Buffer {
  const { cote } = gabarit;
  const rgba = Buffer.alloc(cote * cote * 4);
  const echantillons = SURECHANTILLONNAGE * SURECHANTILLONNAGE;

  for (let py = 0; py < cote; py++) {
    for (let px = 0; px < cote; px++) {
      let rouge = 0;
      let vert = 0;
      let bleu = 0;
      let couverts = 0;

      for (let sy = 0; sy < SURECHANTILLONNAGE; sy++) {
        for (let sx = 0; sx < SURECHANTILLONNAGE; sx++) {
          const couleur = couleurAu(
            (px + (sx + 0.5) / SURECHANTILLONNAGE) / cote,
            (py + (sy + 0.5) / SURECHANTILLONNAGE) / cote,
            gabarit,
          );
          if (!couleur) continue;
          rouge += couleur[0];
          vert += couleur[1];
          bleu += couleur[2];
          couverts++;
        }
      }

      const i = (py * cote + px) * 4;
      if (couverts > 0) {
        rgba[i] = Math.round(rouge / couverts);
        rgba[i + 1] = Math.round(vert / couverts);
        rgba[i + 2] = Math.round(bleu / couverts);
      }
      rgba[i + 3] = Math.round((couverts / echantillons) * 255);
    }
  }

  return encoderPng(cote, rgba, gabarit.rayonFond > 0);
}

const dossier = join(process.cwd(), "public", "icons");
mkdirSync(dossier, { recursive: true });

for (const gabarit of GABARITS) {
  const png = rendre(gabarit);
  writeFileSync(join(dossier, gabarit.fichier), png);
  console.log(`${gabarit.fichier} : ${gabarit.cote} px, ${png.length} octets`);
}
