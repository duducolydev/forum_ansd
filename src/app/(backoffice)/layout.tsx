import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ROLE_LABELS } from "@/lib/permissions";
import { getEtatMenu } from "@/lib/sidebar-serveur";

// Le middleware redirige les visiteurs sans jeton et impose l'enrôlement 2FA.
// Mais il ne voit que le jeton signé, pas la base : une session fermée depuis
// (compte désactivé, mot de passe réinitialisé — PLAN.md §18) lui paraît
// valide. `auth()` la revalide, et renvoie alors vers la connexion. Chaque page
// garde en plus son propre contrôle : un layout n'est pas rejoué à chaque
// navigation interne.
export default async function BackofficeLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  const userName = session?.user?.name ?? "—";
  const roleName = session?.user?.roleName
    ? (ROLE_LABELS[session.user.roleName] ?? session.user.roleName)
    : "—";

  // État du menu lu côté serveur : le premier rendu est déjà replié ou déplié,
  // sans saut de mise en page à chaque navigation.
  const etatMenu = await getEtatMenu();

  return (
    <div className="bg-bg-2 flex min-h-screen">
      <AdminSidebar
        userName={userName}
        roleName={roleName}
        permissions={session?.user?.permissions ?? []}
        etatInitial={etatMenu}
      />
      <main className="min-w-0 flex-1 p-7">{children}</main>
    </div>
  );
}
