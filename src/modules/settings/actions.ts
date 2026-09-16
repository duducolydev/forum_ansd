"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import {
  categorieSchema,
  identiteSchema,
  inscriptionsSchema,
  piedDePageSchema,
  themeSchema,
  RESEAUX_LABELS,
} from "./schema";

export interface EtatAction {
  erreur?: string;
  avis?: string;
}

/** `settings.write` : le §12 ne l'accorde qu'au SUPER_ADMIN. */
async function exigerParametreur() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "settings.write")) throw new Error("Permission refusée.");
  const edition = await getActiveEdition();
  return { acteur: { userId: session.user.id }, editionId: edition.id };
}

function messageErreur(erreur: unknown): string {
  if (erreur && typeof erreur === "object" && "issues" in erreur) {
    const issues = (erreur as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

/** Le thème et le pied de page touchent toutes les pages publiques. */
function rafraichirToutLePublic(): void {
  revalidatePath("/", "layout");
}

export async function enregistrerIdentiteAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();
    const valeurs = identiteSchema.parse({
      title: formData.get("title"),
      theme: formData.get("theme") ?? "",
      startDate: formData.get("startDate"),
      endDate: formData.get("endDate"),
      venue: formData.get("venue"),
      city: formData.get("city"),
    });
    await service.enregistrerIdentite(editionId, valeurs, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichirToutLePublic();
  return { avis: "Édition enregistrée." };
}

export async function enregistrerInscriptionsAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();
    const valeurs = inscriptionsSchema.parse({
      active: formData.get("active") === "on",
      ouvertureLe: formData.get("ouvertureLe") ?? "",
      fermetureLe: formData.get("fermetureLe") ?? "",
      messageFermeFr: formData.get("messageFermeFr") ?? undefined,
      messageFermeEn: formData.get("messageFermeEn") ?? undefined,
    });
    await service.enregistrerInscriptions(editionId, valeurs, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/parametres");
  revalidatePath("/inscription");
  return { avis: "Règles d'inscription enregistrées." };
}

export async function enregistrerThemeAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();
    const valeurs = themeSchema.parse({
      primaire: formData.get("primaire"),
      secondaire: formData.get("secondaire"),
      accent: formData.get("accent"),
      police: formData.get("police"),
      rayon: formData.get("rayon"),
      animation: formData.get("animation"),
    });
    await service.enregistrerTheme(editionId, valeurs, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichirToutLePublic();
  return { avis: "Thème enregistré." };
}

export async function enregistrerPiedDePageAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();

    // Les réseaux sont un champ par réseau connu ; une adresse vide vaut retrait.
    const reseaux = Object.keys(RESEAUX_LABELS)
      .map((reseau) => ({ reseau, url: String(formData.get(`reseau-${reseau}`) ?? "").trim() }))
      .filter((entree) => entree.url.length > 0);

    // Les liens arrivent par paires indexées, éditables par ajout et retrait.
    const liens: { libelle: string; url: string }[] = [];
    for (let index = 0; index < 12; index++) {
      const libelle = String(formData.get(`lien-libelle-${index}`) ?? "").trim();
      const url = String(formData.get(`lien-url-${index}`) ?? "").trim();
      if (libelle && url) liens.push({ libelle, url });
    }

    const valeurs = piedDePageSchema.parse({
      organisation: formData.get("organisation") ?? undefined,
      adresse: formData.get("adresse") ?? undefined,
      email: formData.get("email") ?? "",
      telephone: formData.get("telephone") ?? "",
      mentionCopyright: formData.get("mentionCopyright") ?? undefined,
      reseaux,
      liens,
    });
    await service.enregistrerPiedDePage(editionId, valeurs, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichirToutLePublic();
  return { avis: "Pied de page enregistré." };
}

export async function enregistrerCategorieAction(
  categoryId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();
    const valeurs = categorieSchema.parse({
      labelFr: formData.get("labelFr"),
      labelEn: formData.get("labelEn"),
      color: formData.get("color") ?? "",
      sortOrder: formData.get("sortOrder") ?? 0,
      isActive: formData.get("isActive") === "on",
      autoConfirm: formData.get("autoConfirm") === "on",
      requiresLogistics: formData.get("requiresLogistics") === "on",
      alertOnScan: formData.get("alertOnScan") === "on",
    });
    await service.enregistrerCategorie(editionId, categoryId, valeurs, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/parametres/categories");
  revalidatePath("/inscription");
  return { avis: "Catégorie enregistrée." };
}
