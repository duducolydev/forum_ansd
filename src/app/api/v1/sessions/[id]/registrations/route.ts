import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getActiveEdition } from "@/lib/edition";
import { getSession } from "@/modules/sessions/service";
import { listerInscriptions } from "@/modules/sessions/registration";
import { renderListePresence } from "@/modules/attendance/pdf";
import { versCsv } from "@/modules/reporting/formats";

export const dynamic = "force-dynamic";

/**
 * Export des inscrits d'une session (brief §5.5).
 *
 * `format=csv` pour retravailler la liste, `format=pdf` pour la feuille
 * d'émargement à faire signer en salle. Le gabarit PDF est **celui des
 * présences** (chantier 4.6) : une feuille d'émargement de panel et une feuille
 * d'émargement de journée sont le même document, et en maintenir deux les
 * ferait diverger.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "registrations.manage") && !can(session, "sessions.read")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const [courante, lignes] = await Promise.all([getSession(id), listerInscriptions(id)]);
  if (!courante) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // Les annulations sortent des exports : une feuille d'émargement où figurent
  // des gens qui se sont désinscrits ferait signer des absents.
  const actives = lignes.filter((ligne) => ligne.statut !== "CANCELLED");
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const edition = await getActiveEdition();

  await audit.log({
    actorType: "USER",
    actorUserId: session?.user?.id,
    action: "session_registrations.export",
    entity: "Session",
    entityId: id,
    after: { format, lignes: actives.length },
  });

  if (format === "pdf") {
    const pdf = await renderListePresence({
      editionName: edition.title,
      titre: "Feuille d'émargement",
      sousTitre: courante.titleFr,
      jour: courante.day,
      forme: "EMARGEMENT",
      lignes: actives.map((ligne) => ({
        publicId: ligne.publicId,
        nom: ligne.nom,
        organisation: ligne.organisation,
        categorie: ligne.statut === "WAITLISTED" ? `${ligne.categorie} (attente)` : ligne.categorie,
        pays: ligne.pays,
        premierPassage: null,
      })),
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="emargement-${courante.slug}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // `versCsv` et non une mise en forme locale : c'est lui qui porte le BOM
  // UTF-8 et la neutralisation des formules (PLAN.md §18). Cet export en avait
  // une copie sans cette neutralisation, alors que noms et organisations
  // viennent du formulaire public.
  const csv = versCsv(
    ["Identifiant", "Nom", "Organisation", "Pays", "Categorie", "Statut", "Position"],
    actives.map((ligne) => [
      ligne.publicId,
      ligne.nom,
      ligne.organisation ?? "",
      ligne.pays,
      ligne.categorie,
      ligne.statut,
      ligne.position?.toString() ?? "",
    ]),
  );

  return new NextResponse(new Uint8Array(csv), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inscrits-${courante.slug}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
