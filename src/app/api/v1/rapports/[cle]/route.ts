import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getActiveEdition } from "@/lib/edition";
import { trouverRapport } from "@/modules/reporting/service";
import { estFormat, versCsv, versPdf, versXlsx } from "@/modules/reporting/formats";

export const dynamic = "force-dynamic";

const TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

/**
 * Édition d'un rapport (brief §5.13).
 *
 * **Journalisé systématiquement** : le brief exige de savoir qui a exporté quoi
 * et quand. Un rapport « Participants » contient des adresses et des téléphones ;
 * savoir qu'il est sorti, et par qui, fait partie du dispositif de protection
 * des données autant que le contrôle d'accès qui le précède.
 *
 * Le temps d'édition est consigné avec le reste : c'est ce qui permettra de
 * décider, sur des données réelles, si un mode asynchrone devient nécessaire.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ cle: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "reports.export")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { cle } = await params;
  const rapport = trouverRapport(cle);
  if (!rapport) {
    return NextResponse.json({ error: "Rapport inconnu." }, { status: 404 });
  }

  const demande = new URL(request.url).searchParams.get("format");
  const format = estFormat(demande) ? demande : "xlsx";

  const edition = await getActiveEdition();
  const debut = Date.now();
  const lignes = await rapport.lignes(edition.id);

  let fichier: Buffer;
  if (format === "csv") {
    fichier = versCsv(rapport.colonnes, lignes);
  } else if (format === "xlsx") {
    fichier = versXlsx(rapport.titre, rapport.colonnes, lignes);
  } else {
    fichier = await versPdf(
      { editionName: edition.title, titre: rapport.titre, description: rapport.description },
      rapport.colonnes,
      lignes,
    );
  }

  await audit.log({
    actorType: "USER",
    actorUserId: session?.user?.id,
    action: "report.export",
    entity: "Edition",
    entityId: edition.id,
    after: {
      rapport: cle,
      format,
      lignes: lignes.length,
      octets: fichier.length,
      dureeMs: Date.now() - debut,
    },
  });

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="${cle}-${new Date().toISOString().slice(0, 10)}.${format}"`,
      "X-Rapport-Lignes": String(lignes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
