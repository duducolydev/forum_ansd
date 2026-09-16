import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { fileStorage } from "@/lib/storage";
import { getParticipantSession } from "@/modules/auth/participant-session";
import { recordDownload } from "@/modules/badges/service";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
};

/**
 * Téléchargement d'un badge. Les fichiers sont stockés **hors webroot**
 * (brief §7) et ne sont servis que par cette route, sous contrôle d'accès :
 * le participant concerné, ou un membre du BackOffice ayant `badges.generate`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; format: string }> },
): Promise<NextResponse> {
  const { id, format } = await params;

  const contentType = CONTENT_TYPES[format];
  if (!contentType) {
    return NextResponse.json({ error: "Format inconnu." }, { status: 404 });
  }

  const badge = await prisma.badge.findUnique({
    where: { id },
    select: {
      id: true,
      participantId: true,
      version: true,
      pdfPath: true,
      pngPath: true,
      revokedAt: true,
      participant: { select: { publicId: true } },
    },
  });
  if (!badge) {
    return NextResponse.json({ error: "Badge introuvable." }, { status: 404 });
  }

  const participantSession = await getParticipantSession();
  const isOwner = participantSession?.participantId === badge.participantId;
  const isStaff = can(await auth(), "badges.generate");
  if (!isOwner && !isStaff) {
    // 404 et non 403 : répondre « interdit » confirmerait l'existence du badge.
    return NextResponse.json({ error: "Badge introuvable." }, { status: 404 });
  }

  // Un badge révoqué ne se télécharge plus — sauf pour le BackOffice, qui doit
  // pouvoir consulter l'historique.
  if (badge.revokedAt && !isStaff) {
    return NextResponse.json({ error: "Badge révoqué." }, { status: 410 });
  }

  const path = format === "pdf" ? badge.pdfPath : badge.pngPath;
  if (!path) {
    return NextResponse.json({ error: "Badge pas encore généré." }, { status: 409 });
  }

  let file: Buffer;
  try {
    file = await fileStorage.get(path);
  } catch {
    return NextResponse.json({ error: "Fichier de badge introuvable." }, { status: 404 });
  }

  if (isOwner) {
    await recordDownload(badge.id);
  }

  const filename = `badge-${badge.participant.publicId}-v${badge.version}.${format}`;
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
