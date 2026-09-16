import { FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { LienExterne } from "@/components/ui/bouton";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { RAPPORTS } from "@/modules/reporting/service";

export const dynamic = "force-dynamic";

const FORMATS = [
  { cle: "xlsx", libelle: "Excel", icone: FileSpreadsheet },
  { cle: "csv", libelle: "CSV", icone: FileText },
  { cle: "pdf", libelle: "PDF", icone: FileDown },
] as const;

export default async function RapportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/connexion");
  if (!can(session, "reports.read") && !can(session, "reports.export")) {
    return (
      <div className="border-border bg-surface text-text-2 rounded-xl border p-5">
        Votre rôle ne donne pas accès aux rapports.
      </div>
    );
  }

  const peutExporter = can(session, "reports.export");
  const edition = await getActiveEdition();

  // Le nombre de lignes est calculé à l'affichage : c'est ce qui permet de
  // savoir, avant de cliquer, si l'on va télécharger dix lignes ou mille.
  const tailles = await Promise.all(
    RAPPORTS.map(async (rapport) => (await rapport.lignes(edition.id)).length),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl">Rapports</h2>
        <p className="text-text-3 text-sm">
          Chaque rapport sort dans les trois formats, depuis les mêmes données. Toute édition est
          journalisée.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {RAPPORTS.map((rapport, index) => (
          <section
            key={rapport.cle}
            className="border-border bg-surface flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border p-4"
          >
            <div className="min-w-64 flex-1">
              <h3 className="text-heading text-sm font-semibold">{rapport.titre}</h3>
              <p className="text-text-3 mt-0.5 text-xs">{rapport.description}</p>
            </div>

            <span className="text-text-2 text-sm tabular-nums">{tailles[index]} ligne(s)</span>

            {peutExporter ? (
              <span className="flex gap-2">
                {FORMATS.map((format) => (
                  <LienExterne
                    key={format.cle}
                    href={`/api/v1/rapports/${rapport.cle}?format=${format.cle}`}
                    taille="petit"
                    icone={format.icone}
                    titre={`Télécharger « ${rapport.titre} » en ${format.libelle}`}
                    className="no-underline"
                  >
                    {format.libelle}
                  </LienExterne>
                ))}
              </span>
            ) : (
              <span className="text-text-3 text-xs">Lecture seule</span>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
