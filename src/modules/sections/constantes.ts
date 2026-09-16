/**
 * Constantes partagées entre le service (serveur) et les formulaires (client).
 *
 * Fichier séparé du service, comme pour les partenaires : un composant client
 * qui importerait `service.ts` pour une seule constante entraînerait Prisma
 * dans le paquet du navigateur.
 */

/**
 * Poids maximal d'une illustration de section, après réduction par le
 * navigateur.
 *
 * Deux mégaoctets suffisent très largement pour une image de 1600 px de côté,
 * et restent bien sous la limite de 3 Mo des Server Actions — au-delà de
 * laquelle la plateforme rejette la requête **avant** tout code applicatif,
 * donc sans message.
 */
export const IMAGE_SECTION_MAX_BYTES = 2 * 1024 * 1024;
