import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { detecterImageDeposee } from "@/lib/image-deposee";

/**
 * Logo d'un sponsor.
 *
 * Public **si le sponsor est publié** — c'est une image destinée au site. Tant
 * qu'il ne l'est pas, seul le BackOffice y accède : un partenariat en cours de
 * négociation ne doit pas être devinable en tirant une URL, et l'accord de
 * publication du logo appartient au partenaire.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const sponsor = await prisma.sponsor.findFirst({
    where: { id, deletedAt: null },
    select: { logoPath: true, isPublished: true },
  });
  if (!sponsor?.logoPath) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  if (!sponsor.isPublished && !can(await auth(), "sponsors.write")) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(sponsor.logoPath);
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  /*
   * Le type est redéduit des octets à la lecture, et non lu sur le chemin
   * enregistré. Un fichier remplacé sur le disque sous le même nom ne peut donc
   * pas être servi sous un type qu'il n'a pas.
   */
  const { type: detecte } = detecterImageDeposee(fichier);
  if (!detecte) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  /*
   * Durcissement propre au SVG.
   *
   * La **politique de sécurité de contenu est posée par le middleware**, pas
   * ici : il s'exécute en amont et ses en-têtes l'emportent, si bien qu'une CSP
   * écrite à cet endroit serait remplacée sans bruit. C'est ce qui se passait,
   * et c'est un test qui l'a montré. Voir `sertUnFichierDepose` dans
   * `src/middleware.ts`.
   *
   * Restent à la charge de la route les deux en-têtes qui décrivent le fichier
   * lui-même : `nosniff`, pour qu'aucun navigateur ne requalifie le contenu, et
   * `Content-Disposition: inline` avec un nom, pour qu'une URL forgée ne fasse
   * pas passer le fichier pour autre chose.
   */
  const entetes: Record<string, string> = {
    "Content-Type": detecte.type,
    "Cache-Control": sponsor.isPublished ? "public, max-age=600" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (detecte.vectoriel) {
    entetes["Content-Disposition"] = 'inline; filename="logo.svg"';
  }

  return new NextResponse(new Uint8Array(fichier), { headers: entetes });
}
