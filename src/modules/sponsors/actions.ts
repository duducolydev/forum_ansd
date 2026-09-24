"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { niveauInputSchema, sponsorInputSchema } from "./schema";

export interface EtatAction {
  erreur?: string;
  avis?: string;
}

async function exigerRedaction() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "sponsors.write")) throw new Error("Permission refusée.");
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

function lireFormulaire(formData: FormData) {
  return sponsorInputSchema.parse({
    name: formData.get("name"),
    levelId: formData.get("levelId"),
    descriptionFr: formData.get("descriptionFr") ?? "",
    descriptionEn: formData.get("descriptionEn") ?? "",
    website: formData.get("website") ?? "",
    videoUrl: formData.get("videoUrl") ?? "",
    standNumber: formData.get("standNumber") ?? "",
    contactName: formData.get("contactName") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    isPublished: formData.get("isPublished") === "on",
  });
}

/** La page publique et l'accueil affichent les sponsors : les deux se rafraîchissent. */
function rafraichir(): void {
  revalidatePath("/admin/sponsors");
  revalidatePath("/sponsors");
  revalidatePath("/");
}

export async function creerSponsorAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  let identifiant: string;
  try {
    const { acteur, editionId } = await exigerRedaction();
    const sponsor = await service.creerSponsor(editionId, lireFormulaire(formData), acteur);
    identifiant = sponsor.id;
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichir();
  // Redirection vers la fiche : le logo ne peut être téléversé qu'une fois le
  // sponsor créé, et c'est l'étape suivante attendue.
  redirect(`/admin/sponsors/${identifiant}`);
}

export async function modifierSponsorAction(
  sponsorId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerRedaction();
    await service.modifierSponsor(editionId, sponsorId, lireFormulaire(formData), acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichir();
  return { avis: "Sponsor enregistré." };
}

export async function televerserLogoAction(
  sponsorId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerRedaction();
    const fichier = formData.get("logo");
    if (!(fichier instanceof File)) return { erreur: "Aucun fichier reçu." };
    await service.enregistrerLogo(editionId, sponsorId, fichier, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichir();
  revalidatePath(`/admin/sponsors/${sponsorId}`);
  return { avis: "Logo enregistré." };
}

/**
 * Appelée directement depuis une transition cliente (motif déjà retenu pour
 * les sessions et les zones), pas via `useActionState` : une suppression est
 * confirmée par une boîte de dialogue, pas soumise par un formulaire.
 */
export async function retirerSponsorAction(sponsorId: string): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerRedaction();
    await service.retirerSponsor(editionId, sponsorId, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichir();
  redirect("/admin/sponsors");
}

/**
 * Déplacement d'un partenaire dans l'ordre d'affichage (§32).
 *
 * Les deux pages sont revalidées ensemble : l'ordre du BackOffice **est**
 * celui du site, et n'en rafraîchir qu'une donnerait deux classements
 * différents pour la même donnée, le temps d'un cache.
 */
export async function deplacerSponsorAction(
  sponsorId: string,
  direction: "haut" | "bas",
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerRedaction();
    await service.deplacerSponsor(editionId, sponsorId, direction, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/sponsors");
  revalidatePath("/sponsors");
  return {};
}

export async function enregistrerNiveauAction(
  niveauId: string | null,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerRedaction();
    const input = niveauInputSchema.parse({
      code: formData.get("code"),
      name: formData.get("name"),
      sortOrder: formData.get("sortOrder") ?? 0,
      logoMaxWidth: formData.get("logoMaxWidth") || undefined,
    });
    await service.enregistrerNiveau(editionId, niveauId, input, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichir();
  revalidatePath("/admin/sponsors/niveaux");
  return { avis: "Niveau enregistré." };
}

export async function supprimerNiveauAction(niveauId: string): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerRedaction();
    await service.supprimerNiveau(editionId, niveauId, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichir();
  revalidatePath("/admin/sponsors/niveaux");
  return { avis: "Niveau supprimé." };
}
