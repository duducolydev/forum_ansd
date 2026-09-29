import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { fileStorage } from "@/lib/storage";
import { detectImageType } from "@/modules/participants/photo";
import { estPublic, trouverElement } from "@/modules/medias/service";

/**
 * Fichier d'un élément de la médiathèque : `taille` vaut « photo » ou
 * « vignette ». Le chemin est relu en base, jamais reçu du client.
 *
 * Public si l'élément est visible (publié, et son album aussi) ; sinon réservé
 * à qui peut lire les contenus — un album en préparation n'a pas à être
 * devinable en tirant des identifiants.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; taille: string }> },
): Promise<NextResponse> {
  const { id, taille } = await params;
  const introuvable = NextResponse.json({ error: "Introuvable." }, { status: 404 });
  if (taille !== "photo" && taille !== "vignette") return introuvable;

  const element = await trouverElement(id);
  if (!element) return introuvable;
  const visible = estPublic(element);
  if (!visible && !can(await auth(), "content.read")) return introuvable;

  const chemin = taille === "photo" ? element.filePath : element.thumbPath;
  if (!chemin) return introuvable;

  let fichier: Buffer;
  try {
    fichier = await fileStorage.get(chemin);
  } catch {
    return introuvable;
  }
  const detecte = detectImageType(fichier);
  if (!detecte) return introuvable;

  return new NextResponse(new Uint8Array(fichier), {
    headers: {
      "Content-Type": detecte.type,
      // L'adresse porte l'empreinte du fichier (`?v=`) : un remplacement
      // change d'adresse, le cache peut donc durer.
      "Cache-Control": visible ? "public, max-age=86400" : "private, no-store",
    },
  });
}
