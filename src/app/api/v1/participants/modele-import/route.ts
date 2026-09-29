import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { modeleImport } from "@/modules/participants/import";

/**
 * Modèle d'import des participants. Réservé à qui peut importer : la feuille
 * « Catégories » reprend celles de l'édition.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || !can(session, "participants.import")) {
    return NextResponse.json({ error: "Permission refusée." }, { status: 403 });
  }

  const edition = await getActiveEdition();
  const buffer = await modeleImport(edition.id);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-import-participants.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
