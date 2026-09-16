import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";
import { lireGalerie } from "@/modules/content/schema";

/**
 * Image d'un article : `cle` vaut « couverture » ou le rang dans la galerie.
 *
 * Le client ne transmet **jamais** de chemin de fichier : il désigne une image
 * par sa place, et le serveur résout le chemin depuis la base. Un chemin
 * accepté depuis l'extérieur se transforme vite en lecture arbitraire du
 * volume de stockage.
 *
 * Publique si l'article l'est ; sinon réservée à qui peut lire les contenus —
 * une actualité en préparation n'a pas à être devinable en tirant une URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; cle: string }> },
): Promise<NextResponse> {
  const { id, cle } = await params;

  const article = await prisma.post.findUnique({
    where: { id },
    select: { coverPath: true, gallery: true, isPublished: true },
  });
  if (!article) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  if (!article.isPublished && !can(await auth(), "content.read")) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let chemin: string | null = null;
  if (cle === "couverture") {
    chemin = article.coverPath;
  } else if (/^\d+$/.test(cle)) {
    chemin = lireGalerie(article.gallery)[Number.parseInt(cle, 10)]?.path ?? null;
  }
  if (!chemin) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(chemin);
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const detecte = detectImageType(fichier);
  if (!detecte) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": detecte.type,
      "Cache-Control": article.isPublished ? "public, max-age=600" : "private, no-store",
    },
  });
}
