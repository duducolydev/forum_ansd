import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import * as service from "@/modules/contributions/service";
import { DOCUMENT_MAX_BYTES } from "@/modules/contributions/fichier";
import { MODELES, type TypeContribution } from "@/modules/contributions/schema";

/**
 * Dépôt et service du fichier d'une contribution (brief §5.10).
 *
 * ## Pourquoi une route et non une Server Action
 *
 * Le brief autorise 50 Mo. Les Server Actions de Next s'arrêtent à 3 Mo et
 * rejettent au-delà **avant** que le moindre code applicatif ne s'exécute :
 * l'agent ne voit alors ni image, ni message, ni rien. Ce défaut a déjà coûté
 * deux allers-retours sur les illustrations de section (§13.7). Une présentation
 * de conférence dépasse couramment 3 Mo ; ce chemin ne pouvait donc pas être
 * celui des Server Actions.
 *
 * `POST` dépose, `GET` sert.
 *
 * **Réserve assumée** : le fichier transite en mémoire le temps du contrôle de
 * type, soit 50 Mo au plus. À l'échelle du Forum — quelques agents déposant les
 * supports d'une trentaine de sessions — c'est sans conséquence. Passer en
 * écriture par flux demanderait d'étendre l'interface de stockage, ce qui n'a
 * d'intérêt que le jour où les fichiers seront servis depuis un objet distant.
 */

/**
 * Compte BackOffice ayant une permission de contribution, quelle qu'elle soit.
 * Le périmètre exact — toutes les sessions, ou les seules sessions rattachées —
 * est tranché par le service (§15).
 */
async function acteurConnecte(): Promise<service.Acteur | null> {
  const session = await auth();
  const permissions = session?.user?.permissions ?? [];
  if (!session?.user) return null;
  if (
    !permissions.includes("contributions.write") &&
    !permissions.includes("contributions.draft")
  ) {
    return null;
  }
  return { userId: session.user.id, permissions };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const acteur = await acteurConnecte();
  if (!acteur) return NextResponse.json({ erreur: "Permission refusée." }, { status: 403 });

  const { id } = await params;

  /*
   * La taille annoncée est vérifiée **avant** de lire le corps : sans cela, un
   * fichier de 500 Mo serait entièrement mis en mémoire pour être refusé
   * ensuite. L'en-tête peut mentir, d'où le second contrôle après lecture.
   */
  const annonce = Number(request.headers.get("content-length") ?? 0);
  if (annonce > DOCUMENT_MAX_BYTES) {
    return NextResponse.json(
      { erreur: `Fichier trop lourd (maximum ${DOCUMENT_MAX_BYTES / 1024 / 1024} Mo).` },
      { status: 413 },
    );
  }

  const octets = Buffer.from(await request.arrayBuffer());
  if (octets.length === 0) {
    return NextResponse.json({ erreur: "Aucun fichier reçu." }, { status: 400 });
  }
  if (octets.length > DOCUMENT_MAX_BYTES) {
    return NextResponse.json(
      { erreur: `Fichier trop lourd (maximum ${DOCUMENT_MAX_BYTES / 1024 / 1024} Mo).` },
      { status: 413 },
    );
  }

  try {
    const apres = await service.deposerFichier(id, octets, acteur);
    return NextResponse.json({ chemin: apres.filePath });
  } catch (erreur) {
    return NextResponse.json(
      { erreur: erreur instanceof Error ? erreur.message : "Dépôt impossible." },
      { status: erreur instanceof service.ContributionRefusError ? 403 : 400 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const contribution = await prisma.contribution.findUnique({
    where: { id },
    select: { filePath: true, isPublished: true, type: true, title: true, sessionId: true },
  });
  if (!contribution?.filePath) {
    return NextResponse.json({ erreur: "Introuvable." }, { status: 404 });
  }

  // Une contribution non publiée n'est pas devinable en tirant une URL : même
  // règle que les logos de partenaires et les illustrations de section. Le
  // rapporteur voit les brouillons de ses sessions, et d'elles seules.
  if (
    !contribution.isPublished &&
    !(await service.peutVoirBrouillons(await acteurConnecte(), contribution.sessionId))
  ) {
    return NextResponse.json({ erreur: "Introuvable." }, { status: 404 });
  }

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(contribution.filePath);
  } catch {
    return NextResponse.json({ erreur: "Introuvable." }, { status: 404 });
  }

  const modele = MODELES[contribution.type as TypeContribution];
  const extension = contribution.filePath.split(".").pop() ?? "bin";
  const typeMime =
    extension === "pdf"
      ? "application/pdf"
      : extension === "pptx"
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : `image/${extension === "jpg" ? "jpeg" : extension}`;

  /*
   * Un document se télécharge, une image s'affiche.
   *
   * `attachment` sur les documents n'est pas cosmétique : il empêche qu'un
   * fichier déposé par un tiers soit rendu comme un document du site, dans son
   * origine. Le nom proposé vient du titre saisi, pas du nom d'origine.
   */
  const nom = `${contribution.title.replace(/[^\w\- ]+/g, "").trim() || "document"}.${extension}`;
  const disposition = modele.fichier === "image" ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": typeMime,
      "Content-Disposition": `${disposition}; filename="${nom}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": contribution.isPublished ? "public, max-age=600" : "private, no-store",
    },
  });
}
