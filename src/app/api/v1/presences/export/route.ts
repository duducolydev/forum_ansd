import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getActiveEdition } from "@/lib/edition";
import { prisma } from "@/lib/db";
import { getListePresence } from "@/modules/attendance/service";
import { renderListePresence, type FormeListe } from "@/modules/attendance/pdf";

export const dynamic = "force-dynamic";

/**
 * Export PDF des listes de présence (brief §5.6).
 *
 * `forme=EMARGEMENT` produit la feuille à faire signer, `forme=CONSTAT` la
 * liste de ce qui s'est réellement passé. Les filtres — jour, catégorie, zone —
 * sont ceux de l'écran, pour que le document imprimé corresponde exactement à
 * ce que l'utilisateur avait sous les yeux.
 */
function jourValide(valeur: string | null): Date | null {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const jour = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(jour.getTime()) ? null : jour;
}

export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "presences.read")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parametres = new URL(request.url).searchParams;
  const jour = jourValide(parametres.get("jour"));
  if (!jour) {
    return NextResponse.json({ error: "Jour attendu au format AAAA-MM-JJ." }, { status: 400 });
  }

  const forme: FormeListe = parametres.get("forme") === "EMARGEMENT" ? "EMARGEMENT" : "CONSTAT";
  const categoryId = parametres.get("categoryId") || undefined;
  const zoneId = parametres.get("zoneId") || undefined;

  const edition = await getActiveEdition();
  const [lignes, categorie, zone] = await Promise.all([
    getListePresence(edition.id, { jour, categoryId, zoneId }),
    categoryId
      ? prisma.participantCategory.findUnique({
          where: { id: categoryId },
          select: { labelFr: true },
        })
      : null,
    zoneId ? prisma.zone.findUnique({ where: { id: zoneId }, select: { name: true } }) : null,
  ]);

  const precisions = [categorie?.labelFr, zone?.name].filter(Boolean);
  const pdf = await renderListePresence({
    editionName: edition.title,
    titre: forme === "EMARGEMENT" ? "Feuille d'émargement" : "Liste de présence",
    sousTitre: precisions.length > 0 ? precisions.join(" · ") : "Toutes catégories",
    jour,
    forme,
    lignes,
  });

  await audit.log({
    actorType: "USER",
    actorUserId: session?.user?.id,
    action: "presences.export",
    entity: "Edition",
    entityId: edition.id,
    after: {
      forme,
      jour: jour.toISOString().slice(0, 10),
      lignes: lignes.length,
      categoryId,
      zoneId,
    },
  });

  const nom = `presences-${jour.toISOString().slice(0, 10)}-${forme.toLowerCase()}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
