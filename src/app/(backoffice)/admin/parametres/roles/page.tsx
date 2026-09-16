import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { CarteRole } from "@/modules/users/components/carte-role";
import { permissionsSansLibelle } from "@/modules/users/permissions-catalogue";

export const metadata = { title: "Rôles et droits" };

/**
 * Rôles ajustables (§8.2, T46 levé).
 *
 * Réservé à `users.manage` et non à `settings.write` : distribuer des droits
 * n'est pas régler une apparence, et le §12 sépare volontairement les deux.
 */
export default async function RolesPage() {
  const session = await auth();
  if (!session?.user || !can(session, "users.manage")) {
    redirect("/admin");
  }

  const [roles, moi] = await Promise.all([
    prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { users: true } },
        users: { where: { isActive: true }, select: { id: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { roleId: true } }),
  ]);

  // Filet posé avec le catalogue : une permission ajoutée sans libellé
  // n'aurait aucune case à cocher et deviendrait impossible à accorder.
  const orphelines = permissionsSansLibelle();

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/parametres" className="text-link text-sm">
          ← Paramètres
        </Link>
        <h2 className="mt-1 text-2xl">Rôles et droits</h2>
        <span className="text-text-3 text-sm">
          {roles.length} rôles. Un droit ajouté ou retiré prend effet immédiatement pour ses
          titulaires.
        </span>
      </div>

      {orphelines.length > 0 && (
        <p className="bg-warn-soft text-warn-text mb-4 rounded-lg px-4 py-3 text-sm">
          {orphelines.length} permission(s) sans libellé dans le catalogue — {orphelines.join(", ")}{" "}
          — donc invisibles ici. À déclarer dans
          <code className="mx-1">permissions-catalogue.ts</code>.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {roles.map((role) => (
          <CarteRole
            key={role.id}
            estMonRole={role.id === moi?.roleId}
            role={{
              id: role.id,
              name: role.name,
              permissions: (role.permissions as string[] | null) ?? [],
              comptes: role._count.users,
              comptesActifs: role.users.length,
            }}
          />
        ))}
      </div>
    </div>
  );
}
