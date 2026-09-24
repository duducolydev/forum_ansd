/**
 * Catalogue central des permissions RBAC (brief §12).
 * Le brief ne donne que des « exemples » ; ce catalogue les complète de façon
 * cohérente pour couvrir chaque module du §3.2. À étendre au fil des modules,
 * jamais en dehors de ce fichier (source unique de vérité pour `can()`).
 */
export const PERMISSIONS = [
  "participants.read",
  "participants.write",
  "participants.delete",
  "participants.export",
  "invitations.read",
  "invitations.write",
  "invitations.send",
  "delegations.read",
  "delegations.write",
  "badges.generate",
  "badges.revoke",
  "badges.print",
  "sessions.read",
  "sessions.write",
  "speakers.read",
  "speakers.write",
  "registrations.manage",
  "scan.use",
  "presences.read",
  "zones.manage",
  "content.read",
  "content.write",
  /*
   * Hébergement et infos pratiques (§29) : hôtels partenaires, tarifs,
   * contacts, et les zones éditoriales des six rubriques.
   *
   * Un jeton distinct de `content.write`, qui ouvre **tout** l'éditorial du
   * site : le gestionnaire des hôtels négocie des tarifs, il n'a pas à
   * pouvoir réécrire la page d'accueil ni les mentions légales.
   */
  "hotels.manage",
  "sponsors.write",
  "contributions.write",
  "contributions.draft",
  "notifications.send_bulk",
  "notifications.manage",
  "dashboard.read",
  "reports.read",
  "reports.export",
  "users.manage",
  "audit.read",
  "settings.write",
  "editions.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Rôles prédéfinis (brief §12) et leurs permissions par défaut. Modifiable en BackOffice. */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  SUPER_ADMIN: PERMISSIONS,
  ADMIN_FORUM: PERMISSIONS.filter(
    (p) => !["users.manage", "settings.write", "editions.manage"].includes(p),
  ),
  GESTIONNAIRE_PARTICIPANTS: [
    "participants.read",
    "participants.write",
    "participants.delete",
    "participants.export",
    "invitations.read",
    "invitations.write",
    "invitations.send",
    "delegations.read",
    "delegations.write",
    "badges.generate",
    "badges.revoke",
    "badges.print",
    "notifications.send_bulk",
  ],
  AGENT_ACCUEIL: [
    "scan.use",
    "presences.read",
    "participants.read",
    "participants.write",
    "badges.generate",
    "badges.print",
  ],
  GESTIONNAIRE_PROGRAMME: [
    "sessions.read",
    "sessions.write",
    "speakers.read",
    "speakers.write",
    "registrations.manage",
    "contributions.write",
    "participants.read",
  ],
  GESTIONNAIRE_COMMUNICATION: [
    "content.read",
    "content.write",
    "sponsors.write",
    "notifications.send_bulk",
  ],
  GESTIONNAIRE_STATISTIQUES: ["dashboard.read", "reports.read", "reports.export"],
  /**
   * Gestionnaire des hôtels (§29), hors des huit rôles du brief : tient
   * l'hébergement et les informations pratiques, et rien d'autre.
   *
   * `content.read` l'accompagne pour qu'il relise les rubriques dans le
   * BackOffice sans pouvoir toucher au reste de l'éditorial.
   */
  GESTIONNAIRE_HOTELS: ["hotels.manage", "content.read"],
  LECTEUR: [
    "participants.read",
    "invitations.read",
    "delegations.read",
    "sessions.read",
    "speakers.read",
    "content.read",
    "dashboard.read",
    "reports.read",
    "presences.read",
  ],
  /**
   * Rapporteur de session (§15), hors des huit rôles du brief : rédige des
   * contributions sur les sessions auxquelles il est rattaché, et sur elles
   * seules. Il ne publie pas — la publication reste au gestionnaire programme.
   */
  RAPPORTEUR: ["contributions.draft"],
};

/** Libellés lisibles des rôles (§12), pour l'affichage BackOffice. */
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Administrateur",
  ADMIN_FORUM: "Administrateur Forum",
  GESTIONNAIRE_PARTICIPANTS: "Gestionnaire Participants",
  AGENT_ACCUEIL: "Agent Accueil",
  GESTIONNAIRE_PROGRAMME: "Gestionnaire Programme",
  GESTIONNAIRE_COMMUNICATION: "Gestionnaire Communication",
  GESTIONNAIRE_HOTELS: "Gestionnaire des hôtels",
  GESTIONNAIRE_STATISTIQUES: "Gestionnaire Statistiques",
  LECTEUR: "Lecteur",
  RAPPORTEUR: "Rapporteur",
};
