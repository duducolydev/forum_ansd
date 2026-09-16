import { FileDown } from "lucide-react";
import { LienExterne } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import * as service from "@/modules/audit/service";
import { auditSearchSchema } from "@/modules/audit/schema";
import { BarreFiltres } from "@/modules/audit/components/barre-filtres";
import { TableAudit } from "@/modules/audit/components/table-audit";
import { Pagination } from "@/modules/participants/components/pagination";

export const metadata = { title: "Journal d'audit" };

/**
 * Journal d'audit consultable et exportable (brief §5.14).
 *
 * L'écriture existait depuis le Lot 0 (`src/lib/audit.ts`) ; la lecture non —
 * un journal que personne ne peut ouvrir ne sert qu'après coup, en base.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || !can(session, "audit.read")) {
    redirect("/admin");
  }

  const sp = await searchParams;
  const search = auditSearchSchema.parse(sp);

  const [{ items, total }, filtres] = await Promise.all([
    service.listerEntrees(search),
    service.valeursDeFiltre(),
  ]);

  const parametresExport = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(sp)) {
    if (valeur && cle !== "page" && cle !== "pageSize") parametresExport.set(cle, valeur);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Journal d&apos;audit</h2>
          <span className="text-text-3 text-sm">
            {total} entrée{total > 1 ? "s" : ""}
            {total > service.EXPORT_MAX_LIGNES
              ? ` — l'export est plafonné à ${service.EXPORT_MAX_LIGNES.toLocaleString("fr-FR")} lignes`
              : ""}
          </span>
        </div>
        <LienExterne href={`/api/v1/audit/export?${parametresExport.toString()}`} icone={FileDown}>
          Exporter en CSV
        </LienExterne>
      </div>

      <BarreFiltres actions={filtres.actions} entites={filtres.entites} acteurs={filtres.acteurs} />
      <TableAudit entrees={items} />
      <Pagination
        page={search.page}
        pageSize={search.pageSize}
        total={total}
        basePath="/admin/audit"
        searchParams={sp}
      />
    </div>
  );
}
