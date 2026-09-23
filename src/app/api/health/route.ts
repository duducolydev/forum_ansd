import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Supervision : cette réponse ne doit jamais venir d'un cache.
 *
 * Sans directive, un proxy intermédiaire peut garder un « db: up » et le
 * resservir alors que la base est tombée — la supervision afficherait alors du
 * vert sur un portail en panne, ce qui est pire que pas de supervision du tout.
 * Demandé par la DSI de l'ANSD à l'issue du scan du 23 septembre 2026.
 *
 * L'en-tête est posé explicitement plutôt que laissé au comportement par défaut
 * de Next : ce défaut a déjà changé d'une version majeure à l'autre, et une
 * garantie de supervision n'a pas à dépendre de ce qu'un framework décide.
 */
const ENTETES_SANS_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" } as const;

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" }, { headers: ENTETES_SANS_CACHE });
  } catch (error) {
    /*
     * Le détail reste dans les journaux du serveur. Cette route est publique :
     * le message du pilote MySQL, qui peut nommer l'hôte, l'utilisateur ou la
     * base, n'a pas à y être renvoyé (PLAN.md §18). Supervision et `stack.sh`
     * ne lisent que le code HTTP.
     */
    console.error("[health] base de données injoignable :", error);
    return NextResponse.json(
      { status: "degraded", db: "down" },
      { status: 503, headers: ENTETES_SANS_CACHE },
    );
  }
}
