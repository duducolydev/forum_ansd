import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { lireParametres, listerCategories } from "@/modules/settings/service";
import { LigneCategorie } from "@/modules/settings/components/ligne-categorie";
import { NouvelleCategorie } from "@/modules/settings/components/nouvelle-categorie";

export const metadata = { title: "Catégories de participants" };

/**
 * Catégories de participants (brief §4, §5.14).
 *
 * Le code d'une catégorie n'est pas modifiable : il est référencé par la
 * matrice d'accès, les modèles de badge et le seed. Le renommer casserait ces
 * liens sans prévenir — le libellé, lui, est ce que le public lit et se change
 * librement.
 *
 * Depuis le 24 octobre 2026, une catégorie se crée aussi ici (le comité
 * d'organisation en a été le premier besoin), avec ses zones d'accès, sa
 * visibilité sur le formulaire public et sa mention sur le badge.
 */
export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user || !can(session, "settings.write")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const categories = await listerCategories(edition.id);
  const auto = categories.filter((categorie) => categorie.autoConfirm).length;
  const validationComite = lireParametres(edition).inscriptions.validationComite;

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/parametres" className="text-link text-sm">
          ← Paramètres
        </Link>
        <h2 className="mt-1 text-2xl">Catégories de participants</h2>
        <span className="text-text-3 text-sm">
          {validationComite ? (
            <>
              {categories.length} catégories. La validation par le comité est activée pour toute
              inscription en ligne (
              <Link href="/admin/parametres" className="text-link">
                Paramètres › Inscriptions
              </Link>
              ) : la « validation automatique » des catégories est suspendue.
            </>
          ) : (
            <>
              {categories.length} catégories — {auto} en validation automatique. Les autres
              attendent une confirmation du comité.
            </>
          )}
        </span>
      </div>

      <NouvelleCategorie
        categories={categories.map((categorie) => ({
          id: categorie.id,
          code: categorie.code,
          labelFr: categorie.labelFr,
        }))}
      />

      <div className="flex flex-col gap-3">
        {categories.map((categorie) => (
          <LigneCategorie
            key={categorie.id}
            categorie={{
              id: categorie.id,
              code: categorie.code,
              labelFr: categorie.labelFr,
              labelEn: categorie.labelEn,
              labelPt: categorie.labelPt ?? "",
              color: categorie.color ?? "",
              sortOrder: categorie.sortOrder,
              isActive: categorie.isActive,
              autoConfirm: categorie.autoConfirm,
              requiresLogistics: categorie.requiresLogistics,
              alertOnScan: categorie.alertOnScan,
              requiresAccreditation: categorie.requiresAccreditation,
              isPublic: categorie.isPublic,
              badgeMention: categorie.badgeMention ?? "",
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
