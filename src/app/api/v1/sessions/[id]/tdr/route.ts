import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";

/**
 * Termes de référence d'une session (brief §5.8).
 *
 * Public **si la session est publiée** : c'est un document destiné aux
 * participants. Tant qu'elle est en brouillon, seuls les porteurs de
 * `sessions.read` y accèdent — un TDR de panel en préparation circule
 * autrement que par le site.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const session = await prisma.session.findFirst({
    where: { id, deletedAt: null },
    select: { tdrPath: true, isPublished: true, slug: true },
  });

  if (!session?.tdrPath) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  if (!session.isPublished && !can(await auth(), "sessions.read")) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(session.tdrPath);
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // Le type n'est pas déduit de l'extension : seul un PDF a pu être déposé
  // (contrôle sur les octets à l'envoi), et on le revérifie ici.
  if (fichier.subarray(0, 4).toString("ascii") !== "%PDF") {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="tdr-${session.slug}.pdf"`,
      "Cache-Control": session.isPublished ? "public, max-age=300" : "private, no-store",
    },
  });
}
