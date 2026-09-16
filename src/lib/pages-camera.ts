/**
 * Pages qui utilisent la caméra (PLAN.md §16).
 *
 * Source unique, lue par deux acteurs qui doivent rester d'accord :
 *
 * - le **middleware**, qui n'autorise la caméra (`Permissions-Policy`) que sur
 *   ces pages ;
 * - le **menu du BackOffice**, qui y mène par un rechargement complet.
 *
 * Le second point n'est pas un détail. La politique est fixée **au chargement
 * du document** ; une navigation interne de Next.js garde le document de
 * départ, donc sa politique. Arrivé sur `/scan` depuis `/admin` par le menu,
 * l'agent héritait de `camera=()` : caméra refusée, sans que ni l'appareil ni
 * ses réglages y soient pour rien.
 *
 * Sans dépendance : le middleware s'exécute dans le runtime Edge.
 */

export const PAGES_CAMERA = ["/scan", "/admin/accueil"] as const;

export function utiliseLaCamera(chemin: string): boolean {
  return PAGES_CAMERA.some((page) => chemin === page || chemin.startsWith(`${page}/`));
}
