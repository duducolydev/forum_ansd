import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { SELECTION_MAX, exporterSelection } from "@/modules/badges/bulk";

export const dynamic = "force-dynamic";

const corpsSchema = z.object({
  badgeIds: z
    .array(z.string().min(1).max(64))
    .min(1, "Aucun badge sélectionné.")
    .max(SELECTION_MAX, `Pas plus de ${SELECTION_MAX} badges à la fois.`),
  rangement: z.enum(["delegation", "plat"]).default("plat"),
  marquer: z.boolean().default(false),
});

/**
 * Archive ZIP des badges cochés sur la planche d'impression (22 novembre 2026).
 *
 * En POST, à la différence de l'export par filtre : la liste d'identifiants ne
 * tient pas proprement dans une URL, et une sélection n'a pas vocation à être
 * rejouée depuis l'historique. Le marquage reste **demandé**, jamais supposé.
 * Mêmes en-têtes que l'export par filtre, lus par `bouton-export-zip.tsx`.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "badges.print")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible." }, { status: 400 });
  }
  const analyse = corpsSchema.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json(
      { error: analyse.error.issues[0]?.message ?? "Sélection invalide." },
      { status: 400 },
    );
  }

  const edition = await getActiveEdition();
  const archive = await exporterSelection(
    edition.id,
    analyse.data.badgeIds,
    session?.user?.id,
    analyse.data.rangement,
    analyse.data.marquer,
  );

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
