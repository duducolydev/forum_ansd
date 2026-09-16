import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { exporterZip, type FiltreBadges } from "@/modules/badges/bulk";

export const dynamic = "force-dynamic";

/**
 * Archive ZIP des badges, rangée par délégation (brief §5.4).
 *
 * Le nombre de badges manquants voyage dans un en-tête plutôt que dans le
 * corps : le corps est l'archive elle-même, et l'utilisateur doit pouvoir
 * apprendre qu'il manque vingt fichiers sans avoir à l'ouvrir.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "badges.print")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parametres = new URL(request.url).searchParams;
  const etat = parametres.get("etat");
  const filtre: FiltreBadges = {
    categoryId: parametres.get("categoryId") || undefined,
    delegationId: parametres.get("delegationId") || undefined,
    etat: etat === "SANS" || etat === "AVEC" || etat === "REVOQUE" ? etat : undefined,
  };

  const edition = await getActiveEdition();
  const archive = await exporterZip(edition.id, filtre, session?.user?.id);

  return new NextResponse(new Uint8Array(archive.fichier), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${archive.nom}"`,
      "X-Badges-Inclus": String(archive.inclus),
      "X-Badges-Manquants": String(archive.manquants),
      "Cache-Control": "private, no-store",
    },
  });
}
