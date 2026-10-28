"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Deux emplois, deux tailles :
 *
 * - `surface` : surface visée pour chaque logo, en px². Pour la tuile, celle
 *   du logo d'UNFPA tel qu'il s'affichait (≈ 165 × 77 px), la référence
 *   choisie par le comité le 27 octobre 2026 ; pour le bandeau défilant, la
 *   même proportion à sa hauteur d'origine (≈ 132 × 61 px, 28 octobre 2026).
 * - `hauteurMax` : un logo carré ou en hauteur s'arrête là, sans quoi il
 *   dominerait la rangée.
 * - `repli` : l'affichage d'avant, tant que la mesure n'est pas faite.
 */
const GABARITS = {
  tuile: { surface: 12_800, hauteurMax: 112, repli: "max-h-20" },
  bandeau: { surface: 8_100, hauteurMax: 80, repli: "max-h-16" },
} as const;

/** Côté du canevas d'analyse : assez pour situer les bords, assez petit pour rester instantané. */
const COTE_ANALYSE = 320;

/** Alpha sous lequel un pixel compte pour vide. */
const OPAQUE = 24;

/** Canal au-dessus duquel un pixel opaque passe pour du blanc. */
const BLANC = 236;

/** Zone réellement dessinée du logo, en fractions de l'image entière. */
interface Cadre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Largeur sur hauteur de la zone dessinée, en pixels de l'image. */
  ratio: number;
}

type Fond = "TRANSPARENT" | "BLANC" | "AUCUN";

/**
 * Mesures déjà faites, par adresse d'image : le bandeau défilant répète
 * chaque logo deux à quatre fois pour boucler. Un échec n'est pas retenu, la
 * mesure sera retentée.
 */
const mesures = new Map<string, Cadre>();

function estBlanc(pixels: Uint8ClampedArray, i: number): boolean {
  return Math.min(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!) >= BLANC;
}

/**
 * Le fond se lit aux quatre coins ; trois suffisent, un logo pouvant en
 * toucher un. Un fond coloré (un drapeau plein cadre) n'est pas rogné : on
 * ne saurait pas où s'arrête le logo.
 */
function fondDe(pixels: Uint8ClampedArray, largeur: number, hauteur: number): Fond {
  const coins = [0, largeur - 1, (hauteur - 1) * largeur, hauteur * largeur - 1].map(
    (rang) => rang * 4,
  );
  if (coins.filter((i) => pixels[i + 3]! < OPAQUE).length >= 3) return "TRANSPARENT";
  if (coins.filter((i) => pixels[i + 3]! >= OPAQUE && estBlanc(pixels, i)).length >= 3) {
    return "BLANC";
  }
  return "AUCUN";
}

/**
 * Mesure la zone dessinée d'un logo chargé. Les fichiers déposés n'ont pas les
 * mêmes marges : celui de l'Union africaine n'occupe que 29 % de la hauteur de
 * son image, celui d'UNFPA 96 %. À cadre égal, le premier paraissait trois fois
 * plus petit.
 */
function mesurer(image: HTMLImageElement): Cadre | null {
  const { naturalWidth: largeurImage, naturalHeight: hauteurImage } = image;
  // Un SVG sans dimensions propres n'en a pas : affichage simple.
  if (!largeurImage || !hauteurImage) return null;

  const echelle = Math.min(1, COTE_ANALYSE / Math.max(largeurImage, hauteurImage));
  const l = Math.max(1, Math.round(largeurImage * echelle));
  const h = Math.max(1, Math.round(hauteurImage * echelle));
  const canevas = document.createElement("canvas");
  canevas.width = l;
  canevas.height = h;
  const contexte = canevas.getContext("2d", { willReadFrequently: true });
  if (!contexte) return null;

  let pixels: Uint8ClampedArray;
  try {
    contexte.drawImage(image, 0, 0, l, h);
    pixels = contexte.getImageData(0, 0, l, h).data;
  } catch {
    // Canevas illisible (navigateur prudent avec un SVG) : affichage simple.
    return null;
  }

  const fond = fondDe(pixels, l, h);
  if (fond === "AUCUN") {
    return { x: 0, y: 0, largeur: 1, hauteur: 1, ratio: largeurImage / hauteurImage };
  }

  let gauche = l;
  let haut = h;
  let droite = -1;
  let bas = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const i = (y * l + x) * 4;
      if (pixels[i + 3]! < OPAQUE || (fond === "BLANC" && estBlanc(pixels, i))) continue;
      if (x < gauche) gauche = x;
      if (x > droite) droite = x;
      if (y < haut) haut = y;
      if (y > bas) bas = y;
    }
  }
  if (droite < 0) return null;

  const largeur = (droite - gauche + 1) / l;
  const hauteur = (bas - haut + 1) / h;
  return {
    x: gauche / l,
    y: haut / h,
    largeur,
    hauteur,
    ratio: (largeur * largeurImage) / (hauteur * hauteurImage),
  };
}

/**
 * Logo de partenaire calibré (demande du 27 octobre 2026) : les marges vides
 * du fichier sont rognées à l'affichage, puis chaque logo reçoit la même
 * surface. Une hauteur commune aurait laissé un logo carré deux fois plus
 * petit qu'un logo en longueur.
 *
 * Le fichier n'est pas retouché — il reste tel que le partenaire l'a fourni.
 * Avant la mesure, ou si elle échoue, le logo s'affiche comme avant.
 */
export function LogoCalibre({
  src,
  alt,
  gabarit = "tuile",
  className = "",
}: {
  src: string;
  alt: string;
  gabarit?: keyof typeof GABARITS;
  className?: string;
}) {
  const refImage = useRef<HTMLImageElement>(null);
  const [cadre, setCadre] = useState<Cadre | null>(null);
  const { surface, hauteurMax, repli } = GABARITS[gabarit];

  const calibrer = useCallback(() => {
    if (!refImage.current) return;
    const mesure = mesures.get(src) ?? mesurer(refImage.current);
    if (mesure) mesures.set(src, mesure);
    setCadre(mesure);
  }, [src]);

  // Image déjà chargée avant l'hydratation : `onLoad` ne viendra plus.
  useEffect(() => {
    if (refImage.current?.complete) calibrer();
  }, [calibrer]);

  const hauteur = cadre ? Math.min(hauteurMax, Math.sqrt(surface / cadre.ratio)) : 0;

  return (
    <span
      className={`relative block max-w-full overflow-hidden ${className}`}
      style={cadre ? { width: hauteur * cadre.ratio, aspectRatio: cadre.ratio } : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- servi par une route contrôlée, dimensions variables */}
      <img
        ref={refImage}
        src={src}
        alt={alt}
        onLoad={calibrer}
        // L'image entière, décalée pour que seule sa zone dessinée tombe dans
        // le cadre : les pourcentages se rapportent au cadre, qui a les
        // proportions de cette zone.
        className={cadre ? "absolute max-w-none" : `block max-w-full object-contain ${repli}`}
        style={
          cadre
            ? {
                width: `${100 / cadre.largeur}%`,
                height: `${100 / cadre.hauteur}%`,
                left: `${(-100 * cadre.x) / cadre.largeur}%`,
                top: `${(-100 * cadre.y) / cadre.hauteur}%`,
              }
            : undefined
        }
      />
    </span>
  );
}
