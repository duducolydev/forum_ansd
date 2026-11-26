import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { deposerFichier } from "@/modules/newsletters/service";
import { servirFichierNewsletter } from "@/modules/newsletters/fichier-servi";
import { FICHIER_NEWSLETTER_MAX_BYTES, NewsletterRuleError } from "@/modules/newsletters/schema";

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
  return servirFichierNewsletter(id, "telechargement");
}
