"use server";

import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { apercuEnvoi, publierEtEnvoyer, type ApercuEnvoi } from "./envoi";
import { ciblageSchema, parseNewsletterForm } from "./schema";

export interface EtatAction {
  erreur?: string;
  avis?: string;
  /** Identifiant de la newsletter créée : le formulaire y dépose ensuite le fichier. */
  id?: string;
}

/**
 * Points d'entrée des newsletters (§34).
 *
 * Gardés par `content.write`, comme les actualités : c'est la même
 * responsabilité éditoriale. Le fichier, lui, passe par une route
 * (`/api/v1/newsletters/[id]/fichier`) : une Server Action s'arrête à 3 Mo.
 */

async function exigerRedaction(): Promise<{
  session: Session & { user: NonNullable<Session["user"]> };
  editionId: string;
}> {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "content.write")) throw new Error("Permission refusée.");
  const edition = await getActiveEdition();
  return {
    session: session as Session & { user: NonNullable<Session["user"]> },
    editionId: edition.id,
  };
}

function acteur(session: { user: { id: string } }) {
  return { type: "USER" as const, userId: session.user.id };
}

function messageErreur(erreur: unknown): string {
  if (erreur && typeof erreur === "object" && "issues" in erreur) {
    const issues = (erreur as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return erreur instanceof Error ? erreur.message : "Une erreur est survenue.";
}

/** Les pages publiques sont revalidées avec le BackOffice. */
function rafraichir(id?: string, slug?: string): void {
  revalidatePath("/admin/newsletters");
  if (id) revalidatePath(`/admin/newsletters/${id}`);
  revalidatePath("/newsletters");
  if (slug) revalidatePath(`/newsletters/${slug}`);
}

/** Crée le brouillon et renvoie son identifiant ; le formulaire dépose ensuite le fichier. */
export async function creerNewsletterAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { session, editionId } = await exigerRedaction();
    const creee = await service.creerNewsletter(
      editionId,
      parseNewsletterForm(formData),
      acteur(session),
    );
    rafraichir();
    return { id: creee.id };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}

export async function modifierNewsletterAction(
  id: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { session } = await exigerRedaction();
    const modifiee = await service.modifierNewsletter(
      id,
      parseNewsletterForm(formData),
      acteur(session),
    );
    rafraichir(id, modifiee.slug);
    return { id, avis: "Newsletter enregistrée." };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}

export async function supprimerNewsletterAction(
  id: string,
  _etat: EtatAction,
): Promise<EtatAction> {
  try {
    const { session } = await exigerRedaction();
    await service.supprimerNewsletter(id, acteur(session));
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichir();
  return {};
}

export async function publierSansEnvoyerAction(id: string): Promise<EtatAction> {
  try {
    const { session } = await exigerRedaction();
    const newsletter = await service.publierNewsletter(id, acteur(session));
    rafraichir(id, newsletter.slug);
    return { avis: "Newsletter publiée sur le site, sans envoi." };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}

export async function depublierAction(id: string): Promise<EtatAction> {
  try {
    const { session } = await exigerRedaction();
    const newsletter = await service.depublierNewsletter(id, acteur(session));
    rafraichir(id, newsletter.slug);
    return { avis: "Newsletter retirée du site." };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}

/** Ce que l'envoi ferait avec ce ciblage : nombre de destinataires et plan. */
export async function apercuEnvoiAction(
  id: string,
  ciblage: unknown,
): Promise<ApercuEnvoi | { erreur: string }> {
  try {
    const { editionId } = await exigerRedaction();
    return await apercuEnvoi(editionId, id, ciblageSchema.parse(ciblage));
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}

export async function publierEtEnvoyerAction(id: string, ciblage: unknown): Promise<EtatAction> {
  try {
    const { session, editionId } = await exigerRedaction();
    const resultat = await publierEtEnvoyer(
      editionId,
      id,
      ciblageSchema.parse(ciblage),
      acteur(session),
    );
    rafraichir(id);
    const etalement =
      resultat.jours > 1 ? `, étalé sur ${resultat.jours} jours pour tenir les quotas` : "";
    return {
      avis: `Newsletter publiée. Envoi programmé vers ${resultat.destinataires} participant(s)${etalement}.`,
    };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}
