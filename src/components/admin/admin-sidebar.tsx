import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

const NAV_GROUPS = [
  {
    label: null,
    items: [{ href: "/admin", label: "Tableau de bord" }],
  },
  {
    label: "Participants",
    items: [
      { href: "/admin/participants", label: "Participants" },
      { href: "/admin/invitations", label: "Invitations" },
      { href: "/admin/delegations", label: "Délégations" },
      { href: "/admin/badges", label: "Badges" },
    ],
  },
  {
    label: "Jour J",
    items: [
      { href: "/admin/scanner", label: "Scanner" },
      { href: "/admin/presences", label: "Présences" },
      { href: "/admin/zones", label: "Zones d'accès" },
    ],
  },
  {
    label: "Programme",
    items: [
      { href: "/admin/sessions", label: "Sessions" },
      { href: "/admin/intervenants", label: "Intervenants" },
      { href: "/admin/contributions", label: "Contributions" },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/contenus", label: "Contenus" },
      { href: "/admin/sponsors", label: "Sponsors" },
      { href: "/admin/notifications", label: "Notifications" },
    ],
  },
  {
    label: "Pilotage",
    items: [
      { href: "/admin/rapports", label: "Rapports" },
      { href: "/admin/utilisateurs", label: "Utilisateurs" },
      { href: "/admin/audit", label: "Journal d'audit" },
    ],
  },
] as const;

export function AdminSidebar({ userName, roleName }: { userName: string; roleName: string }) {
  return (
    <aside className="border-dark-panel-line bg-dark-panel text-dark-panel-muted border-r px-3.5 py-5.5">
      <div className="border-dark-panel-line mb-3 flex items-center gap-2.5 border-b px-2.5 pt-1.5 pb-4.5">
        <span className="from-ansd-bleu-vif to-ansd-vert-vif font-display grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br text-[0.8rem] font-bold text-white">
          {userName
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </span>
        <span>
          <b className="block text-white">{userName}</b>
          <span className="text-[0.74rem]">{roleName}</span>
        </span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label ?? "root"}>
            {group.label && (
              <div className="mt-4 mb-1.5 px-2.5 text-[0.7rem] text-[#6E8AA6]">{group.label}</div>
            )}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-dark-panel-muted flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[0.88rem] hover:bg-white/8 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="border-dark-panel-line mt-4 border-t pt-3">
          <SignOutButton />
        </div>
      </nav>
    </aside>
  );
}
