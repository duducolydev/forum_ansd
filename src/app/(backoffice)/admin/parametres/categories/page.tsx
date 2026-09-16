import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { listerCategories } from "@/modules/settings/service";
import { LigneCategorie } from "@/modules/settings/components/ligne-categorie";

export const metadata = { title: "Catégories de participants" };

/**
 * Catégories de participants (brief §4, §5.14).
 *
 * Le code d'une catégorie n'est pas modifiable : il est référencé par la
 * matrice d'accès, les modèles de badge et le seed. Le renommer casserait ces
 * liens sans prévenir — le libellé, lui, est ce que le public lit et se change
 * librement.
 */
export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user || !can(session, "settings.write")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const categories = await listerCategories(edition.id);
  const auto = categories.filter((categorie) => categorie.autoConfirm).length;

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/parametres" className="text-link text-sm">
          ← Paramètres
        </Link>
        <h2 className="mt-1 text-2xl">Catégories de participants</h2>
        <span className="text-text-3 text-sm">
          {categories.length} catégories — {auto} en validation automatique. Les autres attendent
          une confirmation du comité.
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {categories.map((categorie) => (
          <LigneCategorie
            key={categorie.id}
            categorie={{
              id: categorie.id,
              code: categorie.code,
              labelFr: categorie.labelFr,
              labelEn: categorie.labelEn,
              color: categorie.color ?? "",
              sortOrder: categorie.sortOrder,
              isActive: categorie.isActive,
              autoConfirm: categorie.autoConfirm,
              requiresLogistics: categorie.requiresLogistics,
              alertOnScan: categorie.alertOnScan,
              inscrits: categorie._count.participants,
            }}
          />
        ))}
      </div>

      <p className="text-text-3 mt-4 text-xs">
        Les zones ouvertes à chaque catégorie se règlent sous{" "}
        <Link href="/admin/zones" className="text-link">
          Zones d&apos;accès
        </Link>
        .
      </p>
    </div>
  );
}
