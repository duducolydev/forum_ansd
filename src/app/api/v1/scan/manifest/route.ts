import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { buildManifeste, etagManifeste } from "@/modules/scan/manifest";

export const dynamic = "force-dynamic";

/**
 * Manifeste hors ligne du scanner (brief §5.6).
 *
 * Réservé aux porteurs de `scan.use`. Un 401 plutôt qu'une redirection : le
 * scanner appelle cette route en arrière-plan, et une page de connexion en
 * guise de réponse JSON produirait une erreur d'analyse illisible dans les
 * journaux de l'appareil.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "scan.use")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const edition = await getActiveEdition();
  const manifeste = await buildManifeste(edition.id, edition.code);
  const etag = etagManifeste(manifeste);

  // Un manifeste inchangé ne repart pas : c'est ce qui rend supportable un
  // rafraîchissement toutes les dix minutes sur six appareils.
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "private, no-cache" },
    });
  }

  return NextResponse.json(manifeste, {
    headers: {
      ETag: etag,
      // `no-cache` et non `no-store` : le navigateur garde la copie mais
      // revalide, ce qui est exactement le comportement voulu avec l'ETag.
      "Cache-Control": "private, no-cache",
    },
  });
}
