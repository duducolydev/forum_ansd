import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/sponsors/service";
import { OrdreSponsors } from "@/modules/sponsors/components/ordre-sponsors";

export const metadata = { title: "Sponsors" };

/** Sponsors et partenaires (brief §5.9), groupés par niveau comme sur le site. */
export default async function SponsorsAdminPage() {
  const session = await auth();
  if (!session?.user || !can(session, "sponsors.write")) {
    redirect("/admin");
  }

  const edition = await getActiveEdition();
  const [niveaux, sponsors] = await Promise.all([
    service.listerNiveaux(edition.id),
    service.listerSponsors(edition.id),
  ]);

  const publies = sponsors.filter((sponsor) => sponsor.isPublished).length;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Sponsors et partenaires</h2>
          <span className="text-text-3 text-sm">
            {sponsors.length} partenaire{sponsors.length > 1 ? "s" : ""} — {publies} publié
            {publies > 1 ? "s" : ""} sur le site
          </span>
        </div>
        <div className="flex gap-2">
          <LienBouton href="/admin/sponsors/niveaux" icone={Layers}>
            Niveaux
          </LienBouton>
          <LienBouton href="/admin/sponsors/nouveau" ton="principal" icone={Plus}>
            Ajouter
          </LienBouton>
        </div>
      </div>

      {niveaux.length === 0 && (
        <p className="border-border bg-surface text-text-3 rounded-xl border p-6 text-sm">
          Aucun niveau de partenariat n&apos;est défini. Commencez par en créer sous{" "}
          <Link href="/admin/sponsors/niveaux" className="text-link">
            Niveaux
          </Link>
          .
        </p>
      )}

      {/*
        Une seule liste ordonnée, et non un groupement par niveau (§32).
        Le site n'affiche plus les partenaires par échelon : l'ordre est celui
        décidé ici, et un BackOffice groupé autrement aurait montré un
        classement que la page publique ne reprend pas.
      */}
      <p className="text-text-2 mb-4 max-w-[80ch] text-sm">
        L&apos;ordre ci-dessous est <strong>celui du site</strong>. Le niveau reste affiché sur la
        carte de chaque partenaire, mais ne décide plus de sa place.
      </p>

      {sponsors.length === 0 ? (
        <p className="border-border bg-surface text-text-3 rounded-xl border p-6 text-sm">
          Aucun partenaire pour l&apos;instant.
        </p>
      ) : (
        <OrdreSponsors
          sponsors={sponsors.map((sponsor) => ({
            id: sponsor.id,
            name: sponsor.name,
            niveau: sponsor.level.name,
            logoUrl: sponsor.logoPath ? `/api/v1/sponsors/${sponsor.id}/logo` : null,
            publie: sponsor.isPublished,
          }))}
        />
      )}
    </div>
  );
}
