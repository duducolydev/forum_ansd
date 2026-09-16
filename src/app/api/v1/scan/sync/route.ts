import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { getActiveEdition } from "@/lib/edition";
import { syncPayloadSchema } from "@/modules/scan/schema";
import { enregistrerScans, marquerPresences } from "@/modules/scan/service";

export const dynamic = "force-dynamic";

/**
 * Remontée des scans mis en file par un appareil (brief §5.6).
 *
 * Idempotente par construction : `ScanLog.clientScanId` est unique, et un lot
 * renvoyé après une coupure en plein envoi ne crée pas de doublon de présence.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "scan.use")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible." }, { status: 400 });
  }

  const analyse = syncPayloadSchema.safeParse(corps);
  if (!analyse.success) {
    return NextResponse.json(
      { error: analyse.error.issues[0]?.message ?? "Charge utile invalide." },
      { status: 400 },
    );
  }

  const edition = await getActiveEdition();
  const resultat = await enregistrerScans(edition.id, analyse.data.scans, session?.user?.id);

  const presences = await marquerPresences(
    analyse.data.scans.map((scan) => scan.clientScanId),
  ).catch(() => 0);

  // Journalisé au lot et non au scan : un jour de Forum produit des milliers de
  // passages, et une entrée d'audit par scan noierait tout le reste.
  await audit.log({
    actorType: "USER",
    actorUserId: session?.user?.id,
    action: "scan.sync",
    entity: "Edition",
    entityId: edition.id,
    after: { ...resultat, presences },
  });

  return NextResponse.json({ ...resultat, presences });
}
