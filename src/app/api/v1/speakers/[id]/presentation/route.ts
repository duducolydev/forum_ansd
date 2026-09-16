import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { getSpeakerSession } from "@/modules/speakers/session";

/**
 * Présentation déposée par un intervenant.
 *
 * **Jamais publique.** Un support de présentation appartient à son auteur et
 * n'est pas destiné au site : il circule entre l'intervenant, le comité et la
 * régie. Sa publication éventuelle relève des Actes (Lot 3), avec l'accord de
 * l'auteur.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const session = await getSpeakerSession();
  const estLuiMeme = session?.speakerId === id;
  if (!estLuiMeme && !can(await auth(), "speakers.read")) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const speaker = await prisma.speaker.findFirst({
    where: { id, deletedAt: null },
    select: { presentationPath: true, lastName: true },
  });
  if (!speaker?.presentationPath) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(speaker.presentationPath);
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  if (fichier.subarray(0, 4).toString("ascii") !== "%PDF") {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="presentation-${speaker.lastName}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
