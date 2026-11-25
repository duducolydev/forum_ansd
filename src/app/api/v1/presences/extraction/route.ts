import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getActiveEdition } from "@/lib/edition";
import { getListePresence, lireFiltrePresence } from "@/modules/attendance/service";
import {
  construireExtraction,
  libelleCivilite,
  lireColonnes,
  organisationsDistinctes,
  lireTypeExtraction,
  type FiltresListePresents,
} from "@/modules/attendance/extraction";
import { estFormat, versCsv, versPdf, versXlsx } from "@/modules/reporting/formats";

export const dynamic = "force-dynamic";

const TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function jourValide(valeur: string | null): Date | null {
  if (!valeur || !/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return null;
  const jour = new Date(`${valeur}T00:00:00.000Z`);
  return Number.isNaN(jour.getTime()) ? null : jour;
}

/**
 * Extraction de la liste des présents (25 novembre 2026) : liste nominative
 * aux colonnes choisies, ou regroupement par organisation, pays ou catégorie.
 *
 * Les filtres sont ceux de l'écran (`liste-presents.tsx`), appliqués par le
 * même module (`extraction.ts`) : le fichier contient ce que l'écran montrait.
 * Journalisée comme tout export de données nominatives.
 */
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

  const demande = parametres.get("format");
  const format = estFormat(demande) ? demande : "xlsx";
  const type = lireTypeExtraction(parametres.get("type"));
  const colonnes = lireColonnes(parametres.get("colonnes"));
  const filtres: FiltresListePresents = {
    presence: lireFiltrePresence(parametres.get("presence")),
    categorie: parametres.get("categorie") || undefined,
    pays: parametres.get("pays") || undefined,
    organisation: parametres.get("organisation") || undefined,
    civilite: parametres.get("civilite") || undefined,
    recherche: parametres.get("q") || undefined,
  };

  const edition = await getActiveEdition();
  const lignes = await getListePresence(edition.id, { jour });
  const extraction = construireExtraction(lignes, filtres, type, colonnes);

  const jourIso = jour.toISOString().slice(0, 10);
  let fichier: Buffer;
  if (format === "csv") {
    fichier = versCsv(extraction.colonnes, extraction.lignes);
  } else if (format === "xlsx") {
    fichier = versXlsx(extraction.titre, extraction.colonnes, extraction.lignes);
  } else {
    const organisation = filtres.organisation
      ? organisationsDistinctes(lignes).find((o) => o.cle === filtres.organisation)?.libelle
      : undefined;
    const precisions = [
      dateLongue.format(jour),
      filtres.categorie,
      filtres.pays,
      organisation,
      filtres.civilite ? libelleCivilite(filtres.civilite) : undefined,
      filtres.recherche ? `« ${filtres.recherche} »` : undefined,
    ].filter(Boolean);
    fichier = await versPdf(
      { editionName: edition.title, titre: extraction.titre, description: precisions.join(" · ") },
      extraction.colonnes,
      extraction.lignes,
    );
  }

  await audit.log({
    actorType: "USER",
    actorUserId: session?.user?.id,
    action: "presences.extraction",
    entity: "Edition",
    entityId: edition.id,
    after: {
      jour: jourIso,
      type,
      format,
      colonnes: type === "NOMINATIVE" ? colonnes : undefined,
      ...filtres,
      lignes: extraction.lignes.length,
    },
  });

  const nom = `presences-${jourIso}-${type.toLowerCase()}.${format}`;
  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": TYPES[format],
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
