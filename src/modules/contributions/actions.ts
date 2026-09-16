"use server";

import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";

export interface EtatAction {
  erreur?: string;
  avis?: string;
  /**
   * Change à chaque succès. Sert de clé aux champs du formulaire de création,
   * pour qu'ils repartent vides après un ajout réussi — et seulement après un
   * succès : un refus laisse tout en place (voir `useSoumissionSansRemiseAZero`).
   */
  jeton?: number;
}

/**
 * Garde commune, volontairement large.
 *
 * Elle laisse passer le gestionnaire (`contributions.write`) comme le
 * rapporteur (`contributions.draft`) ; ce que chacun peut faire **sur telle
 * session et telle contribution** est décidé par le service, qui relit le
 * rattachement en base. Une garde fine ici serait une seconde copie de la règle,
 * et deux copies finissent par diverger.
 */
async function exigerCompte(): Promise<service.Acteur> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "contributions.write") && !can(session, "contributions.draft")) {
    throw new Error("Permission refusée.");
  }
  return { userId: session.user.id, permissions: session.user.permissions ?? [] };
}

function message(erreur: unknown): string {
  if (erreur && typeof erreur === "object" && "issues" in erreur) {
    const issues = (erreur as { issues: { message: string }[] }).issues;
    return issues[0]?.message ?? "Données invalides.";
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

function lireFormulaire(formData: FormData) {
  return {
    sessionId: String(formData.get("sessionId") ?? ""),
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? ""),
    body: String(formData.get("body") ?? ""),
    url: String(formData.get("url") ?? ""),
    speakerId: String(formData.get("speakerId") ?? ""),
    isPublished: formData.get("isPublished") === "on",
  };
}

export async function creerContributionAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const acteur = await exigerCompte();
    const edition = await getActiveEdition();
    await service.creer(edition.id, lireFormulaire(formData), acteur);
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
  return { avis: "Contribution ajoutée.", jeton: Date.now() };
}

export async function modifierContributionAction(
  contributionId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const acteur = await exigerCompte();
    await service.modifier(contributionId, lireFormulaire(formData), acteur);
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
  return { avis: "Contribution enregistrée." };
}

/**
 * Appelées depuis une transition cliente, pas via un formulaire : une
 * suppression passe par une boîte de confirmation, un déplacement par une
 * flèche. Même motif que les sections et les zones.
 */
export async function supprimerContributionAction(contributionId: string): Promise<EtatAction> {
  try {
    const acteur = await exigerCompte();
    await service.supprimer(contributionId, acteur);
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
  return {};
}

export async function deplacerContributionAction(
  contributionId: string,
  sens: "haut" | "bas",
): Promise<EtatAction> {
  try {
    const acteur = await exigerCompte();
    await service.deplacer(contributionId, sens, acteur);
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
  return {};
}

export async function rattacherRapporteurAction(
  sessionId: string,
  userId: string,
): Promise<EtatAction> {
  try {
    const acteur = await exigerCompte();
    await service.rattacherRapporteur(sessionId, userId, acteur);
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
  return { avis: "Rapporteur rattaché." };
}

export async function retirerRapporteurAction(
  sessionId: string,
  userId: string,
): Promise<EtatAction> {
  try {
    const acteur = await exigerCompte();
    await service.retirerRapporteur(sessionId, userId, acteur);
  } catch (erreur) {
    return { erreur: message(erreur) };
  }
  return { avis: "Rapporteur retiré." };
}
