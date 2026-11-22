import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Les deux logos des listes de présence, en `data:` URI (22 novembre 2026).
 *
 * Le Forum en haut à droite de l'en-tête, les 20 ans de l'ANSD en bas à droite
 * du pied de page : les mêmes que ceux des courriels
 * (`modules/notifications/courriel.ts`), pour qu'une feuille signée, un badge
 * et une convocation se reconnaissent comme un seul jeu de documents.
 *
 * ## Pourquoi des `data:` URI
 *
 * Le HTML du document est autonome, et le rendu ne l'attend d'aucun réseau
 * (`lib/pdf.ts` charge la page en `domcontentloaded`). Un `src="/images/…"`
 * resterait un cadre vide. C'est d'autant plus vrai du pied de page, que
 * Chromium rend dans un document à part.
 *
 * ## Pourquoi un cache mémoire
 *
 * Comme pour le logo du badge (`modules/badges/logo.ts`, dont ce module reprend
 * la mécanique) : les fichiers ne changent pas entre deux redémarrages, et une
 * liasse de six cents noms ne doit pas les relire à chaque tirage. La promesse
 * est mise en cache plutôt que son résultat, pour que deux exports simultanés
 * partagent la même lecture.
 *
 * ## Pourquoi des WebP
 *
 * `LOGO-ANSD-20ans-transparent.png` fait 189 Ko, soit 252 Ko de base64 — pour
 * un logo de 11 mm de large au bas de la page. Les versions WebP (92 et 70 Ko)
 * sont les mêmes images, bien au-delà des 300 ppp d'une impression à cette
 * taille.
 */
const CHEMINS = {
  forum: "logo_forum_badge_2026.webp",
  ansd: "logo-ansd-20-ans.webp",
} as const;

const lectures = new Map<string, Promise<string>>();

async function logoDataUrl(fichier: string): Promise<string | null> {
  let lecture = lectures.get(fichier);
  if (!lecture) {
    lecture = readFile(join(process.cwd(), "public", "images", fichier)).then(
      (octets) => `data:image/webp;base64,${octets.toString("base64")}`,
    );
    lectures.set(fichier, lecture);
  }

  try {
    return await lecture;
  } catch (error) {
    /*
     * Une feuille d'émargement sans logo reste une feuille d'émargement : ce
     * qu'on y signe est le nom, pas l'habillage. Refuser l'export pour un
     * fichier manquant priverait l'accueil de ses listes le jour J.
     *
     * La promesse est relâchée pour que la lecture soit retentée : sans cela,
     * un fichier restauré entre-temps resterait ignoré jusqu'au redémarrage.
     */
    lectures.delete(fichier);
    console.error(`[emargement] logo introuvable, document généré sans lui (${fichier}) :`, error);
    return null;
  }
}

/** Logo du Forum, pour l'en-tête. */
export function logoForumDataUrl(): Promise<string | null> {
  return logoDataUrl(CHEMINS.forum);
}

/** Logo des 20 ans de l'ANSD, pour le pied de page. */
export function logoAnsdDataUrl(): Promise<string | null> {
  return logoDataUrl(CHEMINS.ansd);
}
