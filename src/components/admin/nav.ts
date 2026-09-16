import {
  Award,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  FileStack,
  FileText,
  Handshake,
  LayoutDashboard,
  Mail,
  Megaphone,
  Mic,
  QrCode,
  ScanLine,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

/**
 * Source unique de la navigation du BackOffice.
 *
 * Séparée du composant pour être lisible hors de React : c'est cette liste que
 * le test de bout en bout parcourt pour vérifier que chaque entrée mène à une
 * page existante. Quatre entrées ont renvoyé une 404 sans que rien ne s'en
 * aperçoive (PLAN.md §6 bis).
 *
 * Chaque entrée porte la permission que sa page exige réellement, et le menu
 * n'affiche que ce que le rôle peut ouvrir. Sans ce filtrage, un Lecteur voyait
 * « Utilisateurs » puis se faisait renvoyer au tableau de bord sans un mot.
 *
 * Chaque entrée porte aussi son icône. Elle est **décorative** : le libellé
 * reste le nom accessible du lien, et le menu replié conserve ce libellé en
 * infobulle et en `aria-label`. Une icône seule, sans texte, n'aide personne à
 * la première visite.
 */
export interface NavItem {
  href: string;
  label: string;
  icone: LucideIcon;
  permissions: readonly Permission[];
  /**
   * `toutes` (par défaut) : chaque permission est exigée — l'entrée « Accueil »
   * en demande deux, comme sa page. `une` : l'une suffit — « Contributions »
   * s'ouvre au gestionnaire comme au rapporteur, et aucun rôle ne détient les
   * deux (§15).
   */
  exige?: "toutes" | "une";
}

export interface NavGroup {
  label: string | null;
  icone?: LucideIcon;
  items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: null,
    items: [
      {
        href: "/admin",
        label: "Tableau de bord",
        icone: LayoutDashboard,
        permissions: ["dashboard.read"],
      },
    ],
  },
  {
    label: "Participants",
    icone: UsersRound,
    items: [
      {
        href: "/admin/participants",
        label: "Participants",
        icone: Users,
        permissions: ["participants.read"],
      },
      {
        href: "/admin/invitations",
        label: "Invitations",
        icone: Mail,
        permissions: ["invitations.read"],
      },
      {
        href: "/admin/delegations",
        label: "Délégations",
        icone: Handshake,
        permissions: ["delegations.read"],
      },
      { href: "/admin/badges", label: "Badges", icone: BadgeCheck, permissions: ["badges.print"] },
    ],
  },
  {
    label: "Jour J",
    icone: ScanLine,
    items: [
      {
        href: "/admin/accueil",
        label: "Accueil",
        icone: DoorOpen,
        permissions: ["badges.generate", "participants.write"],
      },
      { href: "/scan", label: "Scanner", icone: QrCode, permissions: ["scan.use"] },
      {
        href: "/admin/presences",
        label: "Présences",
        icone: ClipboardList,
        permissions: ["presences.read"],
      },
      {
        href: "/admin/zones",
        label: "Zones d'accès",
        icone: ShieldCheck,
        permissions: ["zones.manage"],
      },
    ],
  },
  {
    label: "Programme",
    icone: CalendarDays,
    items: [
      {
        href: "/admin/sessions",
        label: "Sessions",
        icone: CalendarDays,
        permissions: ["sessions.read"],
      },
      {
        href: "/admin/intervenants",
        label: "Intervenants",
        icone: Mic,
        permissions: ["speakers.read"],
      },
      {
        href: "/admin/contributions",
        label: "Contributions",
        icone: FileStack,
        permissions: ["contributions.write", "contributions.draft"],
        exige: "une",
      },
    ],
  },
  {
    label: "Communication",
    icone: Megaphone,
    items: [
      {
        href: "/admin/contenus",
        label: "Contenus",
        icone: FileText,
        permissions: ["content.read"],
      },
      { href: "/admin/sponsors", label: "Sponsors", icone: Award, permissions: ["sponsors.write"] },
      {
        href: "/admin/notifications",
        label: "Notifications",
        icone: Megaphone,
        permissions: ["notifications.manage"],
      },
    ],
  },
  {
    label: "Pilotage",
    icone: BarChart3,
    items: [
      {
        href: "/admin/rapports",
        label: "Rapports",
        icone: BarChart3,
        permissions: ["reports.read"],
      },
      {
        href: "/admin/parametres",
        label: "Paramètres",
        icone: Settings,
        permissions: ["settings.write"],
      },
      {
        href: "/admin/utilisateurs",
        label: "Utilisateurs",
        icone: Users,
        permissions: ["users.manage"],
      },
      {
        href: "/admin/audit",
        label: "Journal d'audit",
        icone: ScrollText,
        permissions: ["audit.read"],
      },
    ],
  },
];

/** L'entrée est-elle ouverte à ces permissions, selon sa règle `exige` ? */
export function estOuverte(item: NavItem, permissions: readonly string[]): boolean {
  const detenue = (permission: Permission) => permissions.includes(permission);
  return item.exige === "une" ? item.permissions.some(detenue) : item.permissions.every(detenue);
}

/** Ne garde que les entrées que le rôle peut ouvrir. */
export function menuPour(permissions: readonly string[]): NavGroup[] {
  return NAV_GROUPS.map((groupe) => ({
    ...groupe,
    items: groupe.items.filter((item) => estOuverte(item, permissions)),
  })).filter((groupe) => groupe.items.length > 0);
}

/**
 * Entrée correspondant au chemin courant.
 *
 * Le préfixe le plus long l'emporte : sans cela `/admin` — préfixe de tout —
 * serait toujours désigné comme actif, et le tableau de bord resterait surligné
 * sur chaque écran.
 */
export function entreeActive(chemin: string): NavItem | undefined {
  let meilleure: NavItem | undefined;
  for (const groupe of NAV_GROUPS) {
    for (const item of groupe.items) {
      const correspond = chemin === item.href || chemin.startsWith(`${item.href}/`);
      if (correspond && (!meilleure || item.href.length > meilleure.href.length)) {
        meilleure = item;
      }
    }
  }
  return meilleure;
}
