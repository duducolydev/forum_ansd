import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ROLE_LABELS } from "@/lib/permissions";

// La protection d'accès (redirection si non connecté / 2FA non activé) est
// gérée par le middleware (src/middleware.ts) via `auth.config.ts` : ce
// layout peut donc supposer une session valide.
export default async function BackofficeLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userName = session?.user?.name ?? "—";
  const roleName = session?.user?.roleName
    ? (ROLE_LABELS[session.user.roleName] ?? session.user.roleName)
    : "—";

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[236px_1fr]">
      <AdminSidebar userName={userName} roleName={roleName} />
      <main className="bg-bg-2 p-7">{children}</main>
    </div>
  );
}
