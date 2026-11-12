import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { getActiveEdition } from "@/lib/edition";
import { compter, compterAncienGabarit, lister, type FiltreBadges } from "@/modules/badges/bulk";
import { BulkToolbar } from "@/modules/badges/components/bulk-toolbar";
import { BadgesTable } from "@/modules/badges/components/badges-table";

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

  const [lignes, total, aGenerer, ancienGabarit, categories, delegations] = await Promise.all([
    lister(edition.id, filtre, LIMITE),
    compter(edition.id, filtre),
    compter(edition.id, { ...filtre, etat: "SANS" }),
    compterAncienGabarit(edition.id, filtre),
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
          ancienGabarit={ancienGabarit}
        />
      </Suspense>

      <BadgesTable
        lignes={lignes}
        total={total}
        limite={LIMITE}
        peutRevoquer={can(session, "badges.revoke")}
      />
    </div>
  );
}
