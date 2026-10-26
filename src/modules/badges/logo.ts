import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Logo du Forum, en `data:` URI, pour le gabarit du badge (§33).
 *
 * ## Pourquoi un fichier dédié plutôt que le logo officiel
 *
 * Le logo « Dakar 2026 » de l'en-tête du site (`logo-forum-2026.webp`, celui de
 * la maquette du badge) fait 1 800 px de large. Encodé en base64 dans le HTML
 * de **chaque** badge, il alourdirait chaque page pour rien, alors que la cible
 * est de 500 badges en moins de cinq minutes (brief §5.4).
 * `logo_forum_badge_2026.webp` est le même logo réduit à 1 000 px, soit 94 Ko :
 * à 75 mm de large sur le badge, cela fait encore 340 ppp, au-delà des 300 ppp
 * d'une impression. (`logo_forum_badge.png`, l'ancien logo réduit, sert encore
 * aux PDF des lettres d'information.)
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
const CHEMIN = join(process.cwd(), "public", "images", "logo_forum_badge_2026.webp");

export async function logoBadgeDataUrl(): Promise<string | null> {
  lecture ??= readFile(CHEMIN).then(
    (octets) => `data:image/webp;base64,${octets.toString("base64")}`,
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
