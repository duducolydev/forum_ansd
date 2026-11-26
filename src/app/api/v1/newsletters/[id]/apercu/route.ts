import type { NextResponse } from "next/server";
import { servirFichierNewsletter } from "@/modules/newsletters/fichier-servi";

/**
 * Le fichier de synthèse servi `inline`, pour la visionneuse intégrée à la
 * page de la newsletter (26 novembre 2026). Sa politique de sécurité, qui
 * autorise l'affichage dans un cadre du site, est posée par `middleware.ts`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return servirFichierNewsletter(id, "apercu");
}
