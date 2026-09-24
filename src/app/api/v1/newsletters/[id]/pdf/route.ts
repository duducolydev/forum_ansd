import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { renderHtmlToPdf } from "@/lib/pdf";
import { datesDuForum } from "@/modules/badges/dates";
import { logoDataUrl, renderNewsletterPdfHtml } from "@/modules/newsletters/pdf";
import { slugDepuisTitre } from "@/modules/newsletters/schema";

/**
 * PDF d'une newsletter, produit **à la demande** (§34).
 *
 * Rien n'est stocké : le fichier est fabriqué à partir de la page telle qu'elle
 * est à cet instant. Une correction de dernière minute se retrouve donc dans le
 * document téléchargé, alors qu'un PDF produit à la publication et oublié
 * deviendrait une version fantôme, impossible à distinguer de la bonne.
 *
 * Le rendu passe par le navigateur déjà lancé pour les badges : le coût est
 * celui d'une page, pas celui d'un démarrage.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const newsletter = await prisma.newsletter.findUnique({
    where: { id },
    include: { edition: { select: { title: true, startDate: true, endDate: true } } },
  });
  if (!newsletter) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  // Une newsletter en préparation n'est téléchargeable que par qui peut la
  // lire : sans ce contrôle, l'adresse du PDF contournerait la publication.
  if (!newsletter.isPublished && !can(await auth(), "content.read")) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const html = await renderNewsletterPdfHtml({
    titre: newsletter.titleFr,
    chapo: newsletter.excerptFr,
    dates: newsletter.publishedAt
      ? `Publié le ${newsletter.publishedAt.toLocaleDateString("fr-FR", { dateStyle: "long", timeZone: "Africa/Dakar" })}`
      : "Version de travail",
    edition: `${newsletter.edition.title} — ${datesDuForum(newsletter.edition.startDate, newsletter.edition.endDate)}`,
    corps: newsletter.bodyFr,
    images: newsletter.images,
    logoDataUrl: await logoDataUrl(),
  });

  const pdf = await renderHtmlToPdf(html, { format: "A4" });
  const nom = `${slugDepuisTitre(newsletter.titleFr)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // `attachment` : le visiteur a cliqué sur « télécharger », pas sur
      // « ouvrir dans le navigateur ».
      "Content-Disposition": `attachment; filename="${nom}"`,
      "Cache-Control": newsletter.isPublished ? "public, max-age=300" : "private, no-store",
    },
  });
}
