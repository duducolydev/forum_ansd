import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";

/**
 * Photo d'un participant, pour le scanner (brief §5.6).
 *
 * Servie **hors du manifeste**, une par une : embarquer une miniature par
 * participant représenterait environ 8 Mo par cycle et par appareil, toutes les
 * dix minutes. Ici, seule la photo des personnes réellement scannées descend, et
 * le navigateur la garde ensuite en cache.
 *
 * L'affichage de la photo n'est jamais bloquant pour le verdict : si elle
 * n'arrive pas — hors ligne, ou jamais téléchargée — l'agent voit le nom, la
 * catégorie et la couleur, ce qui suffit à décider.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!can(session, "scan.use")) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const { publicId } = await params;
  const participant = await prisma.participant.findFirst({
    where: { publicId: publicId.toUpperCase(), deletedAt: null },
    select: { photoPath: true },
  });

  if (!participant?.photoPath) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(participant.photoPath);
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const detecte = detectImageType(fichier);
  if (!detecte) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": detecte.type,
      // `private` : donnée personnelle, jamais mise en cache par un
      // intermédiaire. Une heure suffit à couvrir une journée de Forum sans
      // re-télécharger la même photo à chaque passage.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
