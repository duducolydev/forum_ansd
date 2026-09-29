"use client";

import { PHOTO_COTE, PHOTO_MAX_OCTETS, VIGNETTE_COTE, VIGNETTE_MAX_OCTETS } from "./schema";

/**
 * Prépare une photo **dans le navigateur**, avant l'envoi : une version plein
 * écran et une vignette pour les grilles.
 *
 * Une photo d'appareil pèse 4 à 10 Mo et une requête est plafonnée à 3 Mo :
 * sans réduction, l'envoi échouerait en silence (voir
 * `lib/redimensionner-image.ts`). La vignette, elle, rend les grilles
 * légères : 48 vignettes de 60 Ko au lieu de 48 photos de 1 Mo.
 *
 * Tout est réencodé en JPEG sur fond blanc : ce sont des photographies, et un
 * PNG à transparence n'a pas sa place dans une galerie.
 */
export interface PhotoPreparee {
  photo: File;
  vignette: File;
  largeur: number;
  hauteur: number;
}

function encoder(toile: HTMLCanvasElement, qualite: number): Promise<Blob | null> {
  return new Promise((resolve) => toile.toBlob(resolve, "image/jpeg", qualite));
}

async function reduire(
  image: ImageBitmap,
  cote: number,
  limite: number,
  qualites: number[],
): Promise<{ blob: Blob; largeur: number; hauteur: number } | null> {
  const facteur = Math.min(1, cote / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * facteur);
  const hauteur = Math.round(image.height * facteur);
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const contexte = toile.getContext("2d");
  if (!contexte) return null;
  contexte.fillStyle = "#ffffff";
  contexte.fillRect(0, 0, largeur, hauteur);
  contexte.drawImage(image, 0, 0, largeur, hauteur);

  for (const qualite of qualites) {
    const blob = await encoder(toile, qualite);
    if (blob && blob.size <= limite) return { blob, largeur, hauteur };
  }
  return null;
}

/** `null` : le fichier n'est pas une image lisible, ou reste trop lourd. */
export async function preparerPhoto(fichier: File): Promise<PhotoPreparee | null> {
  let image: ImageBitmap;
  try {
    // `from-image` : respecte l'orientation EXIF des photos de téléphone.
    image = await createImageBitmap(fichier, { imageOrientation: "from-image" });
  } catch {
    return null;
  }

  try {
    const photo = await reduire(image, PHOTO_COTE, PHOTO_MAX_OCTETS, [0.86, 0.78, 0.7]);
    const vignette = await reduire(image, VIGNETTE_COTE, VIGNETTE_MAX_OCTETS, [0.8, 0.7, 0.6]);
    if (!photo || !vignette) return null;

    const base = fichier.name.replace(/\.[^.]+$/, "") || "photo";
    return {
      photo: new File([photo.blob], `${base}.jpg`, { type: "image/jpeg" }),
      vignette: new File([vignette.blob], `${base}-vignette.jpg`, { type: "image/jpeg" }),
      largeur: photo.largeur,
      hauteur: photo.hauteur,
    };
  } finally {
    image.close();
  }
}
