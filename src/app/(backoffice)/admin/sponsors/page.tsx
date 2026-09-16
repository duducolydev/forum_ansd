import Link from "next/link";
import { Layers, Plus } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "@/modules/sponsors/service";

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

      <div className="flex flex-col gap-6">
        {niveaux.map((niveau) => {
          const duNiveau = sponsors.filter((sponsor) => sponsor.level.id === niveau.id);
          return (
            <div key={niveau.id}>
              <h3 className="text-text-3 mb-2 flex items-center gap-3 text-sm font-medium">
                {niveau.name}
                <span className="bg-border h-px flex-1" />
                <span className="text-xs">{duNiveau.length}</span>
              </h3>
              {duNiveau.length === 0 ? (
                <p className="text-text-3 text-sm">Aucun partenaire à ce niveau.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {duNiveau.map((sponsor) => (
                    <Link
                      key={sponsor.id}
                      href={`/admin/sponsors/${sponsor.id}`}
                      className="border-border bg-surface hover:border-link flex items-center gap-3 rounded-xl border p-4"
                    >
                      {sponsor.logoPath ? (
                        /* eslint-disable-next-line @next/next/no-img-element -- servi par une route contrôlée, hors optimiseur */
                        <img
                          src={`/api/v1/sponsors/${sponsor.id}/logo`}
                          alt=""
                          className="bg-bg h-10 w-16 rounded object-contain"
                        />
                      ) : (
                        <span className="bg-bg-3 text-text-3 grid h-10 w-16 place-items-center rounded text-[0.65rem]">
                          sans logo
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="text-heading block truncate text-sm font-semibold">
                          {sponsor.name}
                        </span>
                        <span className="text-text-3 text-xs">
                          {sponsor.isPublished ? "Publié" : "Brouillon"}
                          {sponsor.standNumber ? ` · stand ${sponsor.standNumber}` : ""}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
