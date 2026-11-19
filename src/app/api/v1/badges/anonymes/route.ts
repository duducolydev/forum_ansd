import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { exporterStockAnonyme } from "@/modules/badges/anonymes";

export const dynamic = "force-dynamic";

/**
 * Archive ZIP du stock de cartes anonymes d'une catégorie (19 novembre 2026).
 *
 * Route distincte de `/api/v1/badges/export`, qui part des participants : ces
 * cartes n'en ont pas. Les fichiers sortent numérotés et triés, pour qu'un lot
 * s'imprime sans retouche.
 *
 * Le marquage « envoyé à l'impression » ne s'applique pas ici : un stock se
 * réimprime à l'identique quand il s'épuise, et le suivi utile est le nombre
 * de cartes restantes, que l'écran affiche.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "badges.print")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const categoryId = new URL(request.url).searchParams.get("categoryId");
  if (!categoryId) {
    return NextResponse.json({ error: "Catégorie manquante." }, { status: 400 });
  }

  const edition = await getActiveEdition();
  const archive = await exporterStockAnonyme(edition.id, categoryId);

  return new NextResponse(new Uint8Array(archive.fichier), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archive.nom}"`,
      "Content-Length": String(archive.fichier.byteLength),
      "X-Badges-Inclus": String(archive.inclus),
      "X-Badges-Manquants": String(archive.manquants),
      "Cache-Control": "private, no-store",
    },
  });
}
