import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Logo du Forum, en `data:` URI, pour le gabarit du badge (§33).
 *
 * ## Pourquoi un fichier dédié plutôt que le logo officiel
 *
 * `logo_forum_transparent.png` pèse 1,48 Mo en 4 460 × 2 000. Encodé en base64
 * dans le HTML de **chaque** badge, il ferait passer chaque page de quelques
 * kilo-octets à plus de deux méga-octets — pour une image rendue à 8 mm de
 * haut, et alors que la cible est de 500 badges en moins de cinq minutes
 * (brief §5.4). `logo_forum_badge.png` est le même logo réduit à 500 px de
 * large, soit 82 Ko : à 8 mm sur une impression à 300 ppp, l'image reste deux
 * fois plus fine que nécessaire.
 *
 * ## Pourquoi un cache mémoire
 *
 * Le fichier ne change jamais entre deux redémarrages. Le relire à chaque
 * badge coûterait 500 lectures disque pour un tirage complet, sans qu'aucune
 * puisse renvoyer autre chose que la précédente.
 *
 * La promesse est mise en cache, et non son résultat : deux badges générés en
 * parallèle au tout premier tirage partagent alors la même lecture au lieu
 * d'en lancer deux.
 */
let lecture: Promise<string> | null = null;

/** Chemin du fichier, résolu depuis la racine du serveur Next (`process.cwd()`). */
const CHEMIN = join(process.cwd(), "public", "images", "logo_forum_badge.png");

export async function logoBadgeDataUrl(): Promise<string | null> {
  lecture ??= readFile(CHEMIN).then(
    (octets) => `data:image/png;base64,${octets.toString("base64")}`,
  );

  try {
    return await lecture;
  } catch (error) {
    /*
     * Un badge sans logo reste un badge valable : il porte le nom, la
     * catégorie et le QR, qui sont ce que le contrôle d'accès vérifie. Faire
     * échouer la génération pour un fichier manquant bloquerait l'accueil le
     * jour J, ce qui serait hors de proportion.
     *
     * La promesse est relâchée pour que la lecture soit retentée : sans cela,
     * un fichier restauré entre-temps resterait ignoré jusqu'au redémarrage.
     */
    lecture = null;
    console.error("[badge] logo introuvable, badge généré sans logo :", error);
    return null;
  }
}
