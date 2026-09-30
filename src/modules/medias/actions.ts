"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { albumSchema, legendeSchema } from "./schema";

export interface EtatMedia {
  erreur?: string;
  avis?: string;
  /** Album créé : l'écran y mène. */
  albumId?: string;
}

/** La médiathèque relève de la communication, comme les actualités (§12). */
async function exigerRedaction() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "content.write")) throw new Error("Permission refusée.");
  const edition = await getActiveEdition();
  return { acteur: { type: "USER" as const, userId: session.user.id }, editionId: edition.id };
}

function message(erreur: unknown): string {
  if (erreur && typeof erreur === "object" && "issues" in erreur) {
    const issues = (erreur as { issues: { message: string }[] }).issues;
    if (issues[0]) return issues[0].message;
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

/** BackOffice et site : un changement se voit aussitôt des deux côtés. */
function rafraichir() {
  revalidatePath("/admin/mediatheque", "layout");
  revalidatePath("/mediatheque", "layout");
}

function lireAlbum(formData: FormData) {
  return albumSchema.parse({
    titleFr: formData.get("titleFr") ?? "",
    titleEn: formData.get("titleEn") ?? "",
    titlePt: formData.get("titlePt") ?? "",
    descriptionFr: formData.get("descriptionFr") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    descriptionPt: formData.get("descriptionPt") ?? "",
    eventDate: formData.get("eventDate") ?? "",
    isPublished: formData.get("isPublished") === "on",
  });
}

function lireLegende(formData: FormData) {
  return legendeSchema.parse({
    captionFr: formData.get("captionFr") ?? "",
    captionEn: formData.get("captionEn") ?? "",
    captionPt: formData.get("captionPt") ?? "",
    credit: formData.get("credit") ?? "",
  });
}

async function executer(action: () => Promise<unknown>): Promise<EtatMedia> {
  try {
    await action();
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
  rafraichir();
  return {};
}

export async function creerAlbumAction(_etat: EtatMedia, formData: FormData): Promise<EtatMedia> {
  try {
    const { acteur, editionId } = await exigerRedaction();
    const album = await service.creerAlbum(editionId, lireAlbum(formData), acteur);
    rafraichir();
    return { albumId: album.id };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function modifierAlbumAction(
  albumId: string,
  _etat: EtatMedia,
  formData: FormData,
): Promise<EtatMedia> {
  try {
    const { acteur } = await exigerRedaction();
    const album = await service.modifierAlbum(albumId, lireAlbum(formData), acteur);
    rafraichir();
    return {
      avis: album.isPublished ? "Album enregistré et publié." : "Album enregistré (non publié).",
    };
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
}

export async function supprimerAlbumAction(albumId: string): Promise<EtatMedia> {
  return executer(async () => {
    const { acteur } = await exigerRedaction();
    await service.supprimerAlbum(albumId, acteur);
  });
}

/** Une photo par appel : le navigateur les envoie l'une après l'autre (limite de 3 Mo). */
export async function ajouterPhotoAction(
  albumId: string | null,
  formData: FormData,
): Promise<EtatMedia> {
  return executer(async () => {
    const { acteur, editionId } = await exigerRedaction();
    const photo = formData.get("photo");
    const vignette = formData.get("vignette");
    if (!(photo instanceof File) || !(vignette instanceof File)) {
      throw new Error("Fichier manquant.");
    }
    const nombre = (cle: string) => {
      const valeur = Number(formData.get(cle));
      return Number.isInteger(valeur) && valeur > 0 && valeur < 20000 ? valeur : null;
    };
    await service.ajouterPhoto(
      editionId,
      albumId,
      {
        photo,
        vignette,
        largeur: nombre("largeur"),
        hauteur: nombre("hauteur"),
        legende: lireLegende(formData),
      },
      acteur,
    );
  });
}

export async function ajouterVideoAction(
  albumId: string | null,
  _etat: EtatMedia,
  formData: FormData,
): Promise<EtatMedia> {
  const resultat = await executer(async () => {
    const { acteur, editionId } = await exigerRedaction();
    const vignette = formData.get("vignette");
    await service.ajouterVideo(
      editionId,
      albumId,
      {
        lien: String(formData.get("lien") ?? ""),
        vignette: vignette instanceof File ? vignette : null,
        legende: lireLegende(formData),
      },
      acteur,
    );
  });
  return resultat.erreur ? resultat : { avis: "Vidéo ajoutée." };
}

export async function modifierLegendeAction(
  itemId: string,
  _etat: EtatMedia,
  formData: FormData,
): Promise<EtatMedia> {
  const resultat = await executer(async () => {
    const { acteur } = await exigerRedaction();
    await service.modifierLegende(itemId, lireLegende(formData), acteur);
  });
  return resultat.erreur ? resultat : { avis: "Légende enregistrée." };
}

export async function basculerVisibiliteAction(itemId: string): Promise<EtatMedia> {
  return executer(async () => {
    const { acteur } = await exigerRedaction();
    await service.basculerVisibilite(itemId, acteur);
  });
}

export async function deplacerElementAction(itemId: string, sens: -1 | 1): Promise<EtatMedia> {
  return executer(async () => {
    await exigerRedaction();
    await service.deplacerElement(itemId, sens === -1 ? -1 : 1);
  });
}

export async function changerAlbumAction(
  itemId: string,
  albumId: string | null,
): Promise<EtatMedia> {
  return executer(async () => {
    const { acteur } = await exigerRedaction();
    await service.changerAlbum(itemId, albumId || null, acteur);
  });
}

export async function supprimerElementAction(itemId: string): Promise<EtatMedia> {
  return executer(async () => {
    const { acteur } = await exigerRedaction();
    await service.supprimerElement(itemId, acteur);
  });
}

export async function definirCouvertureAction(albumId: string, itemId: string): Promise<EtatMedia> {
  return executer(async () => {
    const { acteur } = await exigerRedaction();
    await service.definirCouverture(albumId, itemId, acteur);
  });
}
