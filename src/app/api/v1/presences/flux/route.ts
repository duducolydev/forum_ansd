import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { getFluxRecent } from "@/modules/attendance/service";

export const dynamic = "force-dynamic";

/**
 * Derniers scans, interrogés toutes les cinq secondes par l'écran des présences.
 *
 * Volontairement une simple lecture et non un flux SSE : une connexion longue
 * derrière un proxy inverse demande de désactiver la bufferisation et survit mal
 * aux redémarrages, pour un écran que deux ou trois personnes regardent. Le
 * brief laisse explicitement le choix (§5.6).
 */
export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "presences.read")) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const edition = await getActiveEdition();
  const flux = await getFluxRecent(edition.id);

  return NextResponse.json({ flux }, { headers: { "Cache-Control": "private, no-store" } });
}
