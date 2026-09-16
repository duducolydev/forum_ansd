import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";
import { getSpeakerSession } from "@/modules/speakers/session";

/**
 * Photo d'un intervenant.
 *
 * Publique **si l'intervenant est publié** : c'est une photo destinée au
 * programme. Tant qu'il ne l'est pas, seuls le comité et l'intéressé lui-même y
 * accèdent — un panéliste pressenti qui se désiste ne doit pas avoir laissé son
 * portrait accessible entre-temps.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const speaker = await prisma.speaker.findFirst({
    where: { id, deletedAt: null },
    select: { photoPath: true, isPublished: true },
  });
  if (!speaker?.photoPath) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  if (!speaker.isPublished) {
    const session = await getSpeakerSession();
    const estLuiMeme = session?.speakerId === id;
    if (!estLuiMeme && !can(await auth(), "speakers.read")) {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(speaker.photoPath);
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
      "Cache-Control": speaker.isPublished ? "public, max-age=600" : "private, no-store",
    },
  });
}
