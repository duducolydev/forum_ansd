import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { modeleImport } from "@/modules/speakers/import";

/**
 * Modèle d'import des intervenants. Réservé à qui peut les créer : la feuille
 * « Séances » reprend le programme de l'édition, numéros compris.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || !can(session, "speakers.write")) {
    return NextResponse.json({ error: "Permission refusée." }, { status: 403 });
  }

  const edition = await getActiveEdition();
  const buffer = await modeleImport(edition.id);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-import-intervenants.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
