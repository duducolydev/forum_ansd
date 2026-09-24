import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";
import { lireImages } from "@/modules/newsletters/schema";

/**
 * Image du corps d'une newsletter, désignée par son **rang** (§34).
 *
 * Le client ne transmet jamais de chemin de fichier : il donne une place, et le
 * serveur résout le chemin depuis la base. Un chemin accepté depuis l'extérieur
 * se transforme vite en lecture arbitraire du volume de stockage.
 *
 * Publique si la newsletter l'est ; sinon réservée à qui peut lire les
 * contenus — une newsletter en préparation n'a pas à être devinable en tirant
 * une URL, et c'est précisément le cas pendant qu'on la rédige.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; cle: string }> },
): Promise<NextResponse> {
  const { id, cle } = await params;

  const newsletter = await prisma.newsletter.findUnique({
    where: { id },
    select: { images: true, isPublished: true },
  });
  if (!newsletter) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  if (!newsletter.isPublished && !can(await auth(), "content.read")) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  if (!/^\d+$/.test(cle)) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  const chemin = lireImages(newsletter.images)[Number.parseInt(cle, 10)]?.path ?? null;
  if (!chemin) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(chemin);
  } catch {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  // Type déduit des octets, jamais de l'extension : le fichier est servi au
  // public, et une extension se renomme.
  const detecte = detectImageType(fichier);
  if (!detecte) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": detecte.type,
      "Cache-Control": newsletter.isPublished ? "public, max-age=600" : "private, no-store",
    },
  });
}
