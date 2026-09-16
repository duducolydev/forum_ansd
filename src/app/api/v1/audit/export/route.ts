import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { versCsv } from "@/modules/reporting/formats";
import { auditSearchSchema } from "@/modules/audit/schema";
import * as service from "@/modules/audit/service";

export const dynamic = "force-dynamic";

/**
 * Export CSV du journal d'audit (brief §5.14 : « consultable et exportable »).
 *
 * Les filtres sont ceux de l'écran, pour que le fichier corresponde à ce que
 * l'on avait sous les yeux. L'export est lui-même journalisé : consulter en
 * masse un registre d'actions est une action, et elle doit laisser une trace.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "audit.read")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const parametres = Object.fromEntries(new URL(request.url).searchParams);
  const analyse = auditSearchSchema.safeParse(parametres);
  if (!analyse.success) {
    return NextResponse.json({ error: "Filtres invalides." }, { status: 400 });
  }

  const entrees = await service.entreesPourExport(analyse.data);
  const csv = versCsv(service.COLONNES_CSV, entrees.map(service.ligneCsv));

  await audit.log({
    actorType: "USER",
    actorUserId: session?.user?.id,
    action: "audit.exported",
    entity: "AuditLog",
    entityId: "export",
    after: { lignes: entrees.length, filtres: parametres },
  });

  const nom = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(new Uint8Array(csv), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
