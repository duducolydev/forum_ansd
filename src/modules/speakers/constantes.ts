/**
 * Constantes de l'espace intervenant et du rattachement aux sessions.
 *
 * Dans un fichier sans dépendance pour être lisibles côté navigateur : les
 * importer depuis `service.ts` embarquerait Prisma dans le bundle client, piège
 * déjà rencontré avec les images déposées (§13).
 */

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** 20 Mo : un support de présentation illustré y tient. */
export const PRESENTATION_MAX_BYTES = 20 * 1024 * 1024;

/** Rôle dans une session (brief D2), avec son libellé. */
export const ROLES_SESSION = {
  MODERATOR: "Modération",
  PANELIST: "Panéliste",
  KEYNOTE: "Intervention principale",
  GUEST_OF_HONOR: "Invité d'honneur",
} as const;

export type RoleSession = keyof typeof ROLES_SESSION;

/** Statut de confirmation par session (brief §3), dans l'ordre du parcours. */
export const STATUTS_CONFIRMATION = {
  PRESSENTI: "Pressenti",
  CONTACTE: "Contacté",
  INVITE: "Invité",
  ACCEPTE: "Accepté",
  CONFIRME: "Confirmé",
  PRESENT: "Présent",
} as const;

export type StatutConfirmation = keyof typeof STATUTS_CONFIRMATION;
