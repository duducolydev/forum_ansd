import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { fileStorage } from "@/lib/storage";
import { getParticipantSession } from "@/modules/auth/participant-session";
import { detectImageType } from "@/modules/participants/photo";

/**
 * Photo de profil d'un participant.
 *
 * Servie par cette route et non depuis le webroot (brief §7) : c'est une donnée
 * personnelle, réservée au participant lui-même et au BackOffice. Elle
 * n'apparaît jamais sur la page publique de vérification de badge (§2.11).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const participant = await prisma.participant.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, photoPath: true },
  });

  const session = await getParticipantSession();
  const estProprietaire = session?.participantId === id;
  const estPersonnel = can(await auth(), "participants.read");

  // 404 plutôt que 403 : répondre « interdit » confirmerait que ce participant
  // existe, ce qu'un identifiant deviné ne doit pas permettre d'apprendre.
  if (!participant?.photoPath || (!estProprietaire && !estPersonnel)) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(participant.photoPath);
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // Type déduit du contenu, jamais de l'extension enregistrée : un fichier
  // renommé ne doit pas pouvoir être servi comme autre chose qu'une image.
  const detecte = detectImageType(fichier);
  if (!detecte) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": detecte.type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
