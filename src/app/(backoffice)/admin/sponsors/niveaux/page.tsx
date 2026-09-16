import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/sponsors/service";
import { LigneNiveau } from "@/modules/sponsors/components/ligne-niveau";

export const metadata = { title: "Niveaux de partenariat" };

/**
 * Niveaux paramétrables (brief §5.9).
 *
 * L'ordre d'affichage est porté par `sortOrder` et non par le code : c'est lui
 * qui décide de la hiérarchie visible sur le site public, et il doit pouvoir
 * changer sans renommer quoi que ce soit.
 */
export default async function NiveauxPage() {
  const session = await auth();
  if (!session?.user || !can(session, "sponsors.write")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const niveaux = await service.listerNiveaux(edition.id);

  return (
    <div>
      <div className="mb-5">
        <Link href="/admin/sponsors" className="text-link text-sm">
          ← Sponsors
        </Link>
        <h2 className="mt-1 text-2xl">Niveaux de partenariat</h2>
        <span className="text-text-3 text-sm">
          {niveaux.length} niveau{niveaux.length > 1 ? "x" : ""} — affichés du plus petit ordre au
          plus grand
        </span>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        {niveaux.map((niveau) => (
          <LigneNiveau
            key={niveau.id}
            nombreSponsors={niveau._count.sponsors}
            niveau={{
              id: niveau.id,
              code: niveau.code,
              name: niveau.name,
              sortOrder: niveau.sortOrder,
              logoMaxWidth: niveau.logoMaxWidth,
            }}
          />
        ))}
      </div>

      <h3 className="text-heading mb-2 text-sm font-semibold">Ajouter un niveau</h3>
      <LigneNiveau />
    </div>
  );
}
