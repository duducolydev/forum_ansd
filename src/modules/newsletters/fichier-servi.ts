import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { nomFichierPropre } from "./schema";

/**
 * Sert le fichier de synthèse d'une newsletter, à télécharger ou à afficher.
 *
 * - `telechargement` : `attachment`, compté dans les téléchargements ;
 * - `apercu` : `inline`, pour la visionneuse PDF intégrée à la page de la
 *   newsletter (26 novembre 2026). Non compté — ouvrir la page n'est pas
 *   télécharger.
 *
 * Les deux usages ont chacun leur adresse, parce que leurs politiques de
 * sécurité diffèrent (`middleware.ts`) : le téléchargement est verrouillé par
 * `sandbox`, qui empêcherait la visionneuse de s'afficher ; l'aperçu, lui, doit
 * pouvoir être affiché dans un cadre de la page.
 */
export async function servirFichierNewsletter(
  id: string,
  usage: "telechargement" | "apercu",
): Promise<NextResponse> {
  const newsletter = await prisma.newsletter.findUnique({
    where: { id },
    select: { filePath: true, fileName: true, titleFr: true, isPublished: true },
  });
  if (!newsletter?.filePath) return NextResponse.json({ erreur: "Introuvable." }, { status: 404 });

  // Un brouillon n'est lisible que par qui peut le lire : sans ce contrôle,
  // l'adresse du fichier contournerait la publication.
  if (!newsletter.isPublished && !can(await auth(), "content.read")) {
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
  if (usage === "telechargement" && newsletter.isPublished) {
    await prisma.newsletter
      .update({ where: { id }, data: { downloadCount: { increment: 1 } } })
      .catch(() => undefined);
  }

  const nom = nomFichierPropre(newsletter.fileName, newsletter.titleFr);
  const disposition = usage === "apercu" ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${nom}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "Content-Length": String(fichier.length),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": !newsletter.isPublished
        ? "private, no-store"
        : usage === "apercu"
          ? "public, max-age=300"
          : // `private` : chaque téléchargement doit atteindre le compteur.
            "private, max-age=0",
    },
  });
}
