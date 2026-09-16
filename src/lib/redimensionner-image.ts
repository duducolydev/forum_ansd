"use client";

/**
 * Réduit une image **dans le navigateur**, avant tout envoi.
 *
 * ## Le défaut que cela ferme
 *
 * Les Server Actions de Next acceptent 3 Mo par requête. Au-delà, la plateforme
 * rejette **avant** que le code applicatif ne s'exécute : aucune validation ne
 * tourne, aucun message ne s'affiche, et l'écran ne bouge pas. Mesuré sur
 * l'illustration d'une section :
 *
 * | Taille   | Ce que voit l'agent            |
 * | -------- | ------------------------------ |
 * | 1,8 Mo   | « Section enregistrée. »       |
 * | 2,5 Mo   | « Image trop lourde »          |
 * | 4 Mo     | **rien du tout**               |
 *
 * Or une photographie d'appareil ou de téléphone pèse couramment 4 à 8 Mo. Le
 * cas normal tombait donc dans la zone silencieuse.
 *
 * ## Pourquoi réduire plutôt que relever la limite
 *
 * Une illustration de 6 Mo servie sur la page d'accueil coûterait bien plus
 * cher aux visiteurs qu'à l'agent qui la dépose — et le brief vise 90 de
 * performance (§3.2). Réduire à la volée sert les deux : l'envoi passe, et la
 * page reste légère.
 *
 * Le SVG n'est pas touché : c'est du vectoriel, il ne se rastérise pas sans
 * perdre précisément ce qui fait son intérêt, et il pèse de toute façon
 * quelques kilo-octets.
 */

/** Côté le plus long après réduction. Au-delà, un écran ne montre rien de plus. */
export const COTE_MAX = 1600;

export interface ResultatReduction {
  fichier: File;
  /** Vrai si l'image a réellement été réencodée. */
  reduite: boolean;
}

function encoder(toile: HTMLCanvasElement, type: string, qualite: number): Promise<Blob | null> {
  return new Promise((resolve) => toile.toBlob(resolve, type, qualite));
}

/**
 * Renvoie une version allégée du fichier, ou `null` si elle reste trop lourde.
 *
 * `null` n'est pas une erreur technique : c'est un verdict que l'appelant doit
 * afficher. Une image qui ne peut pas être réduite sous la limite doit être
 * refusée **devant l'agent**, pas envoyée pour être rejetée en silence.
 */
export async function reduirePourEnvoi(
  fichier: File,
  limiteOctets: number,
): Promise<ResultatReduction | null> {
  if (fichier.type === "image/svg+xml" || fichier.name.toLowerCase().endsWith(".svg")) {
    return fichier.size <= limiteOctets ? { fichier, reduite: false } : null;
  }

  let image: ImageBitmap;
  try {
    image = await createImageBitmap(fichier);
  } catch {
    // Illisible comme image : on laisse passer tel quel, le serveur tranchera
    // sur les octets et renverra un message de format.
    return fichier.size <= limiteOctets ? { fichier, reduite: false } : null;
  }

  const facteur = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * facteur);
  const hauteur = Math.round(image.height * facteur);

  // Déjà petite et déjà légère : inutile de la réencoder, ce serait une perte
  // de qualité sans contrepartie.
  if (facteur === 1 && fichier.size <= limiteOctets) return { fichier, reduite: false };

  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const contexte = toile.getContext("2d");
  if (!contexte) return fichier.size <= limiteOctets ? { fichier, reduite: false } : null;
  contexte.drawImage(image, 0, 0, largeur, hauteur);

  /*
   * Le type d'origine est conservé quand c'est possible : un PNG à fond
   * transparent réencodé en JPEG revient sur un aplat blanc, ce qui se voit
   * immédiatement sur un logo. Le repli en JPEG n'intervient que si le PNG,
   * sans perte, reste au-dessus de la limite.
   */
  const tentatives: [string, number][] =
    fichier.type === "image/png"
      ? [
          ["image/png", 1],
          ["image/jpeg", 0.85],
        ]
      : [["image/jpeg", 0.85]];

  for (const [type, qualite] of tentatives) {
    const blob = await encoder(toile, type, qualite);
    if (!blob || blob.size > limiteOctets) continue;

    const extension = type === "image/png" ? "png" : "jpg";
    const base = fichier.name.replace(/\.[^.]+$/, "") || "illustration";
    return {
      fichier: new File([blob], `${base}.${extension}`, { type }),
      reduite: true,
    };
  }

  return null;
}

/** Taille lisible, pour l'afficher à l'agent. */
export function tailleLisible(octets: number): string {
  return octets >= 1024 * 1024
    ? `${(octets / 1024 / 1024).toFixed(1)} Mo`
    : `${Math.round(octets / 1024)} Ko`;
}
