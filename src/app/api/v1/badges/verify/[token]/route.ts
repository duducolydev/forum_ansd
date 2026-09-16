import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyBadgePublicly } from "@/modules/badges/public-verify";
import { adresseClient } from "@/lib/adresse-client";

/** Endpoint public de vérification (brief §5.4). Rate limit : 30/min/IP. */
export const dynamic = "force-dynamic";

// Jamais le premier élément de X-Forwarded-For, que le client choisit (§18).
async function clientIp(): Promise<string> {
  return adresseClient(await headers());
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const result = await verifyBadgePublicly(decodeURIComponent(token), await clientIp());

  if (result.status === "RATE_LIMITED") {
    return NextResponse.json(
      { status: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  // 200 même pour un badge inconnu ou révoqué : ce n'est pas une erreur HTTP,
  // c'est le résultat du contrôle. Un scanner hors ligne (Lot 2) lira `status`.
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
