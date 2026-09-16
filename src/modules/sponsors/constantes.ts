/**
 * Constantes partagées entre le service (serveur) et les formulaires (client).
 *
 * Fichier séparé du service : un composant client qui importerait `service.ts`
 * pour une seule constante entraînerait Prisma dans le paquet du navigateur.
 */

/** Un logo est une image de site web, pas une photo : 2 Mo suffisent largement. */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
