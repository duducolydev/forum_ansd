import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { detecterImageDeposee } from "@/lib/image-deposee";

/**
 * Illustration d'une section de page.
 *
 * Publique **si la section est visible** — c'est une image destinée au site.
 * Tant qu'elle ne l'est pas, seul le BackOffice y accède : une section en
 * préparation ne doit pas être devinable en tirant une URL, pas plus qu'un
 * partenariat en cours de négociation (§5.9).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const section = await prisma.pageSection.findUnique({
    where: { id },
    select: { settings: true, isVisible: true },
  });

  if (!section) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const chemin = (section.settings as Record<string, unknown> | null)?.image;
  if (typeof chemin !== "string" || !chemin) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  if (!section.isVisible && !can(await auth(), "content.write")) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(chemin);
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  /*
   * Le type est redéduit des octets à la lecture, jamais lu sur le chemin
   * enregistré : un fichier remplacé sur le disque sous le même nom ne peut pas
   * être servi sous un type qu'il n'a pas.
   */
  const { type } = detecterImageDeposee(fichier);
  if (!type) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  /*
   * La politique de sécurité de contenu est posée par le **middleware**, pas
   * ici : il s'exécute en amont et ses en-têtes l'emportent. Voir
   * `sertUnFichierDepose` dans `src/middleware.ts`, et §11.5 pour le défaut que
   * cette répartition a fermé.
   */
  const entetes: Record<string, string> = {
    "Content-Type": type.type,
    "Cache-Control": section.isVisible ? "public, max-age=600" : "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (type.vectoriel) {
    entetes["Content-Disposition"] = 'inline; filename="illustration.svg"';
  }

  return new NextResponse(new Uint8Array(fichier), { headers: entetes });
}
