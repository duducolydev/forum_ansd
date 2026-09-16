"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import * as service from "./service";
import {
  creationUtilisateurSchema,
  modificationUtilisateurSchema,
  reinitialisationMdpSchema,
} from "./schema";

export interface EtatAction {
  erreur?: string;
  avis?: string;
}

/**
 * Toute action de cet écran exige `users.manage` (brief §12) — seul le
 * SUPER_ADMIN la porte par défaut. Le contrôle est refait ici et non délégué à
 * la page : une Server Action est une porte d'entrée à part entière, appelable
 * sans jamais passer par l'écran qui la déclare.
 */
async function exigerGestionnaire() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "users.manage")) throw new Error("Permission refusée.");
  return { userId: session.user.id };
}

function messageErreur(erreur: unknown): string {
  if (erreur && typeof erreur === "object" && "issues" in erreur) {
    const issues = (erreur as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

export async function creerUtilisateurAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const acteur = await exigerGestionnaire();
    const input = creationUtilisateurSchema.parse({
      email: formData.get("email"),
      name: formData.get("name"),
      roleId: formData.get("roleId"),
      password: formData.get("password"),
    });
    await service.creerUtilisateur(input, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/utilisateurs");
  return { avis: "Compte créé." };
}

export async function modifierUtilisateurAction(
  userId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const acteur = await exigerGestionnaire();
    const input = modificationUtilisateurSchema.parse({
      name: formData.get("name"),
      roleId: formData.get("roleId"),
      isActive: formData.get("isActive") === "on",
    });
    await service.modifierUtilisateur(userId, input, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/utilisateurs");
  return { avis: "Compte mis à jour." };
}

export async function reinitialiserMotDePasseAction(
  userId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const acteur = await exigerGestionnaire();
    const { password } = reinitialisationMdpSchema.parse({ password: formData.get("password") });
    await service.reinitialiserMotDePasse(userId, password, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/utilisateurs");
  return { avis: "Mot de passe remplacé." };
}

export async function reinitialiserDeuxFacteursAction(
  userId: string,
  _etat: EtatAction,
): Promise<EtatAction> {
  try {
    const acteur = await exigerGestionnaire();
    await service.reinitialiserDeuxFacteurs(userId, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/utilisateurs");
  return { avis: "Second facteur détaché : à réenrôler à la prochaine connexion." };
}

export async function enregistrerRoleAction(
  roleId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const acteur = await exigerGestionnaire();
    // Les cases cochées arrivent toutes sous la même clé.
    const permissions = formData.getAll("permission").map(String);
    await service.enregistrerPermissionsRole(roleId, permissions, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/parametres/roles");
  return { avis: "Droits enregistrés — effectifs immédiatement pour les titulaires." };
}

export async function deverrouillerAction(userId: string, _etat: EtatAction): Promise<EtatAction> {
  try {
    const acteur = await exigerGestionnaire();
    await service.deverrouiller(userId, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/utilisateurs");
  return { avis: "Compte déverrouillé." };
}
