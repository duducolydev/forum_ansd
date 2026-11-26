import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { deposerFichier } from "@/modules/newsletters/service";
import {
  FICHIER_NEWSLETTER_MAX_BYTES,
  NewsletterRuleError,
  nomFichierPropre,
} from "@/modules/newsletters/schema";

/**
 * Fichier de synthèse d'une newsletter (25 novembre 2026) : `POST` dépose ou
 * remplace, `GET` sert.
 *
 * Une route et non une Server Action : celles-ci s'arrêtent à 3 Mo et
 * rejettent au-delà sans qu'aucun code ne s'exécute, donc sans message. Le
 * fichier arrive en corps brut, son nom d'origine dans `X-Nom-Fichier`.
 */

const TROP_LOURD = `Fichier trop lourd (maximum ${FICHIER_NEWSLETTER_MAX_BYTES / 1024 / 1024} Mo).`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user || !can(session, "content.write")) {
    return NextResponse.json({ erreur: "Permission refusée." }, { status: 403 });
  }

  const { id } = await params;

  // La taille annoncée est vérifiée avant de lire le corps ; l'en-tête peut
  // mentir, d'où le second contrôle après lecture.
  if (Number(request.headers.get("content-length") ?? 0) > FICHIER_NEWSLETTER_MAX_BYTES) {
    return NextResponse.json({ erreur: TROP_LOURD }, { status: 413 });
  }
  const octets = Buffer.from(await request.arrayBuffer());
  if (octets.length > FICHIER_NEWSLETTER_MAX_BYTES) {
    return NextResponse.json({ erreur: TROP_LOURD }, { status: 413 });
  }

  let nom = "";
  try {
    nom = decodeURIComponent(request.headers.get("x-nom-fichier") ?? "");
  } catch {
    // Nom mal encodé : le titre servira de nom.
  }

  try {
    const apres = await deposerFichier(id, octets, nom, {
      type: "USER",
      userId: session.user.id,
    });
    revalidatePath(`/admin/newsletters/${id}`);
    revalidatePath("/newsletters");
    return NextResponse.json({ nom: apres.fileName, octets: apres.fileSize });
  } catch (erreur) {
    const regle = erreur instanceof NewsletterRuleError;
    return NextResponse.json(
      { erreur: regle ? erreur.message : "Dépôt impossible." },
      { status: regle ? 400 : 500 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const newsletter = await prisma.newsletter.findUnique({
    where: { id },
    select: { filePath: true, fileName: true, titleFr: true, isPublished: true },
  });
  if (!newsletter?.filePath) return NextResponse.json({ erreur: "Introuvable." }, { status: 404 });

  // Un brouillon n'est téléchargeable que par qui peut le lire : sans ce
  // contrôle, l'adresse du fichier contournerait la publication.
  const lecteurInterne = !newsletter.isPublished && can(await auth(), "content.read");
  if (!newsletter.isPublished && !lecteurInterne) {
    return NextResponse.json({ erreur: "Introuvable." }, { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(newsletter.filePath);
  } catch {
    return NextResponse.json({ erreur: "Introuvable." }, { status: 404 });
  }

  // Seuls les téléchargements publics comptent ; l'échec du compteur ne
  // retient pas le fichier.
  if (newsletter.isPublished) {
    await prisma.newsletter
      .update({ where: { id }, data: { downloadCount: { increment: 1 } } })
      .catch(() => undefined);
  }

  const nom = nomFichierPropre(newsletter.fileName, newsletter.titleFr);
  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nom}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Content-Length": String(fichier.length),
      "X-Content-Type-Options": "nosniff",
      // `private` : chaque téléchargement doit atteindre le compteur.
      "Cache-Control": newsletter.isPublished ? "private, max-age=0" : "private, no-store",
    },
  });
}
