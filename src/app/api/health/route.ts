import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "up" });
  } catch (error) {
    /*
     * Le détail reste dans les journaux du serveur. Cette route est publique :
     * le message du pilote MySQL, qui peut nommer l'hôte, l'utilisateur ou la
     * base, n'a pas à y être renvoyé (PLAN.md §18). Supervision et `stack.sh`
     * ne lisent que le code HTTP.
     */
    console.error("[health] base de données injoignable :", error);
    return NextResponse.json({ status: "degraded", db: "down" }, { status: 503 });
  }
}
