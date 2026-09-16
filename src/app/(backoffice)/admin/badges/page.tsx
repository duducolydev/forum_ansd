import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { compter, lister, type FiltreBadges } from "@/modules/badges/bulk";
import { BulkToolbar } from "@/modules/badges/components/bulk-toolbar";

export const dynamic = "force-dynamic";

const LIMITE = 200;

function lireFiltre(parametres: Record<string, string | undefined>): FiltreBadges {
  const etat = parametres.etat;
  return {
    categoryId: parametres.categoryId || undefined,
    delegationId: parametres.delegationId || undefined,
    etat: etat === "SANS" || etat === "AVEC" || etat === "REVOQUE" ? etat : undefined,
  };
}

export default async function BadgesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "badges.print") && !can(session, "badges.generate")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne donne pas accès aux badges.
      </div>
    );
  }

  const parametres = await searchParams;
  const filtre = lireFiltre(parametres);
  const edition = await getActiveEdition();

  const [lignes, total, aGenerer, categories, delegations] = await Promise.all([
    lister(edition.id, filtre, LIMITE),
    compter(edition.id, filtre),
    compter(edition.id, { ...filtre, etat: "SANS" }),
    prisma.participantCategory.findMany({
      where: { editionId: edition.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, labelFr: true },
    }),
    prisma.delegation.findMany({
      where: { editionId: edition.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl">Badges</h2>
        <p className="text-text-3 text-sm">
          Génération en lot, export par délégation et planche d&apos;impression.
        </p>
      </div>

      <Suspense fallback={null}>
        <BulkToolbar
          categories={categories}
          delegations={delegations}
          total={total}
          aGenerer={aGenerer}
        />
      </Suspense>

      {lignes.length === 0 ? (
        <p className="text-text-2 text-sm">Aucun participant dans ce périmètre.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-text-3 text-xs">
                  <th scope="col" className="px-2 py-2 text-left font-semibold">
                    Participant
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-semibold">
                    Délégation
                  </th>
                  <th scope="col" className="px-2 py-2 text-left font-semibold">
                    Badge
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-semibold">
                    Impressions
                  </th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <tr key={ligne.participantId} className="border-border border-t">
                    <td className="px-2 py-2">
                      <Link
                        href={`/admin/participants/${ligne.participantId}`}
                        className="text-heading font-medium"
                      >
                        {ligne.nom}
                      </Link>
                      <span className="text-text-3 block font-mono text-xs">
                        {ligne.publicId} · {ligne.categorie}
                      </span>
                    </td>
                    <td className="text-text-2 px-2 py-2">{ligne.delegation ?? "—"}</td>
                    <td className="px-2 py-2">
                      {ligne.revoque ? (
                        <span className="bg-danger-soft text-danger-text rounded-md px-2 py-0.5 text-xs font-semibold">
                          Révoqué
                        </span>
                      ) : ligne.genere ? (
                        <a
                          href={`/api/v1/badges/${ligne.badgeId}/pdf`}
                          target="_blank"
                          rel="noopener"
                          className="text-link text-xs font-semibold"
                        >
                          v{ligne.version} · PDF
                        </a>
                      ) : (
                        <span className="text-text-3 text-xs">À générer</span>
                      )}
                    </td>
                    <td className="text-text-2 px-2 py-2 text-right tabular-nums">
                      {ligne.impressions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > LIMITE && (
            <p className="text-text-3 text-xs">
              {LIMITE} premières lignes affichées sur {total}. Les actions de masse portent sur le
              périmètre entier, pas seulement sur ce qui est visible.
            </p>
          )}
        </>
      )}
    </div>
  );
}
