import { PERMISSIONS, type Permission } from "@/lib/permissions";

/**
 * Catalogue lisible des permissions, pour l'écran d'édition des rôles (§8.2).
 *
 * `PERMISSIONS` reste la source de vérité ; ce fichier ne fait que les
 * regrouper et les nommer. Le test associé vérifie que **toutes** y figurent :
 * une permission ajoutée sans libellé deviendrait invisible dans l'écran, donc
 * impossible à accorder, sans qu'aucune erreur ne le signale.
 */

export interface GroupePermissions {
  titre: string;
  permissions: { cle: Permission; label: string; note?: string }[];
}

export const CATALOGUE: GroupePermissions[] = [
  {
    titre: "Participants",
    permissions: [
      { cle: "participants.read", label: "Consulter les participants" },
      { cle: "participants.write", label: "Créer et modifier des participants" },
      { cle: "participants.delete", label: "Supprimer des participants" },
      { cle: "participants.export", label: "Exporter la liste des participants" },
      { cle: "delegations.read", label: "Consulter les délégations" },
      { cle: "delegations.write", label: "Gérer les délégations" },
    ],
  },
  {
    titre: "Invitations et badges",
    permissions: [
      { cle: "invitations.read", label: "Consulter les invitations" },
      { cle: "invitations.write", label: "Créer et importer des invitations" },
      { cle: "invitations.send", label: "Envoyer les invitations et les relances" },
      { cle: "badges.generate", label: "Générer des badges" },
      { cle: "badges.print", label: "Imprimer et exporter des badges" },
      {
        cle: "badges.revoke",
        label: "Révoquer un badge",
        note: "Un badge révoqué est refusé à tous les points de contrôle.",
      },
    ],
  },
  {
    titre: "Programme",
    permissions: [
      { cle: "sessions.read", label: "Consulter les sessions" },
      { cle: "sessions.write", label: "Créer et modifier des sessions" },
      { cle: "speakers.read", label: "Consulter les intervenants" },
      { cle: "speakers.write", label: "Gérer les intervenants" },
      { cle: "registrations.manage", label: "Placer et retirer des inscrits aux panels" },
      {
        cle: "contributions.write",
        label: "Gérer et publier les contributions",
        note: "Toutes les sessions. Rattache aussi les rapporteurs.",
      },
      {
        cle: "contributions.draft",
        label: "Rédiger des contributions sur ses sessions",
        note: "Pour les rapporteurs : seulement les sessions auxquelles le compte est rattaché, sans publication.",
      },
    ],
  },
  {
    titre: "Jour J",
    permissions: [
      { cle: "scan.use", label: "Utiliser le scanner d'accès" },
      { cle: "presences.read", label: "Consulter les présences" },
      {
        cle: "zones.manage",
        label: "Régler les zones et la matrice d'accès",
        note: "Décide de qui entre où : à réserver au comité.",
      },
    ],
  },
  {
    titre: "Communication",
    permissions: [
      { cle: "content.read", label: "Consulter les contenus éditoriaux" },
      { cle: "content.write", label: "Modifier les contenus et les actualités" },
      { cle: "sponsors.write", label: "Gérer les sponsors et partenaires" },
      { cle: "notifications.manage", label: "Gérer les modèles et les rappels" },
      { cle: "notifications.send_bulk", label: "Envoyer des messages groupés" },
    ],
  },
  {
    titre: "Infos pratiques",
    permissions: [
      {
        cle: "hotels.manage",
        label: "Gérer l'hébergement et les infos pratiques",
        note: "Hôtels, tarifs et contacts publiés. N'ouvre pas le reste de l'éditorial.",
      },
    ],
  },
  {
    titre: "Pilotage",
    permissions: [
      { cle: "dashboard.read", label: "Voir le tableau de bord" },
      { cle: "reports.read", label: "Consulter les rapports" },
      { cle: "reports.export", label: "Exporter les rapports" },
      { cle: "audit.read", label: "Consulter et exporter le journal d'audit" },
    ],
  },
  {
    titre: "Administration",
    permissions: [
      {
        cle: "users.manage",
        label: "Gérer les comptes et les rôles",
        note: "Donne accès à cet écran même : à n'accorder qu'en connaissance de cause.",
      },
      { cle: "settings.write", label: "Modifier les paramètres et l'apparence" },
      { cle: "editions.manage", label: "Gérer les éditions" },
    ],
  },
];

/** Permissions qui n'auraient pas de case à cocher — doit rester vide. */
export function permissionsSansLibelle(): Permission[] {
  const cataloguees = new Set(
    CATALOGUE.flatMap((groupe) => groupe.permissions.map((permission) => permission.cle)),
  );
  return PERMISSIONS.filter((permission) => !cataloguees.has(permission));
}
