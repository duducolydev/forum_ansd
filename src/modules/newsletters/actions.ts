"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { parseNewsletterForm } from "./schema";

export interface EtatAction {
  erreur?: string;
  avis?: string;
  /** Rang de l'image qui vient d'être ajoutée, à insérer dans le document. */
  cleImage?: number;
}

/**
 * Points d'entrée des newsletters (§34).
 *
 * Gardés par `content.write`, comme les actualités : c'est la même
 * responsabilité éditoriale, et inventer un jeton pour un objet de plus aurait
 * obligé à trancher, rôle par rôle, une question qui ne se pose pas.
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

/**
 * Les pages publiques sont revalidées avec le BackOffice.
 *
 * La liste et la fiche lisent la même donnée que l'écran d'édition : n'en
 * rafraîchir qu'une laisserait le visiteur devant un texte que le rédacteur
 * voit déjà corrigé.
 */
function rafraichir(slug?: string): void {
  revalidatePath("/admin/newsletters");
  revalidatePath("/newsletters");
  if (slug) revalidatePath(`/newsletters/${slug}`);
}

export async function creerNewsletterAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  let destination: string;
  try {
    const { session, editionId } = await exigerRedaction();
    const creee = await service.creerNewsletter(
      editionId,
      parseNewsletterForm(formData),
      acteur(session),
    );
    destination = `/admin/newsletters/${creee.id}`;
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichir();
  // `redirect` lance : il doit rester **hors** du `try`, sinon le catch
  // l'attraperait et la redirection deviendrait un message d'erreur.
  redirect(destination);
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
    rafraichir(modifiee.slug);
    return { avis: "Newsletter enregistrée." };
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

export async function envoyerNewsletterAction(id: string, _etat: EtatAction): Promise<EtatAction> {
  try {
    const { session, editionId } = await exigerRedaction();
    const { destinataires } = await service.envoyerNewsletter(editionId, id, acteur(session));
    rafraichir();
    return {
      avis: `Envoi lancé vers ${destinataires} destinataire(s). Les messages partent par la file d'attente.`,
    };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}

export async function ajouterImageAction(
  id: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { session } = await exigerRedaction();
    const fichier = formData.get("image");
    if (!(fichier instanceof File)) return { erreur: "Aucun fichier reçu." };

    const { cle } = await service.ajouterImage(id, fichier, acteur(session));
    revalidatePath(`/admin/newsletters/${id}`);
    return { cleImage: cle, avis: "Image ajoutée : insérez-la où vous voulez dans le texte." };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}
