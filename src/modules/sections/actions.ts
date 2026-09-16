"use server";

import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { typeSection } from "./catalogue";
import { boutonSchema, lireTexte, sectionInputSchema } from "./schema";

export interface EtatAction {
  erreur?: string;
  avis?: string;
}

async function exigerRedaction() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  // Composer les pages relève de la communication, comme les contenus (§12).
  if (!can(session, "content.write")) throw new Error("Permission refusée.");
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

export async function ajouterSectionAction(
  page: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerRedaction();
    const type = String(formData.get("type") ?? "");
    await service.creerSection(editionId, page, type, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
  return { avis: "Section ajoutée, masquée pour l'instant : réglez-la avant de l'afficher." };
}

/**
 * Lit les boutons d'un formulaire.
 *
 * Ils arrivent par lignes indexées ; une ligne sans adresse ni libellé est
 * ignorée, ce qui donne le retrait sans bouton dédié.
 */
function lireBoutonsDuFormulaire(formData: FormData, max: number) {
  const boutons: unknown[] = [];
  for (let index = 0; index < max; index++) {
    const href = String(formData.get(`bouton-href-${index}`) ?? "").trim();
    const labelFr = String(formData.get(`bouton-fr-${index}`) ?? "").trim();
    if (!href || !labelFr) continue;
    boutons.push({
      href,
      labelFr,
      labelEn: String(formData.get(`bouton-en-${index}`) ?? "").trim(),
      style: formData.get(`bouton-style-${index}`) === "principal" ? "principal" : "secondaire",
    });
  }
  return boutons.filter((bouton) => boutonSchema.safeParse(bouton).success);
}

export async function enregistrerSectionAction(
  sectionId: string,
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur } = await exigerRedaction();

    const section = await service.trouverSection(sectionId);
    if (!section) return { erreur: "Section introuvable." };
    const modele = typeSection(section.type);
    if (!modele) return { erreur: "Type de section inconnu." };

    const contentFr: Record<string, string> = {};
    const contentEn: Record<string, string> = {};
    for (const champ of modele.champs) {
      contentFr[champ.cle] = String(formData.get(`fr-${champ.cle}`) ?? "");
      contentEn[champ.cle] = String(formData.get(`en-${champ.cle}`) ?? "");
    }

    /*
     * L'illustration voyage dans **le même formulaire** que le reste de la
     * section, et part donc au même « Enregistrer ».
     *
     * C'est la leçon du logo de partenaire (§11.7) : là-bas, le fichier avait
     * son propre formulaire et son propre bouton, à côté du bouton principal.
     * Choisir un fichier puis cliquer sur « Enregistrer » — le geste naturel —
     * ne l'envoyait pas, et l'écran répondait quand même « enregistré ». Ici,
     * un seul geste, donc rien à oublier.
     */
    const settings: Record<string, unknown> = {};
    let ancienneImage: string | null = null;

    for (const champ of modele.reglages) {
      if (champ.type === "booleen") settings[champ.cle] = formData.get(champ.cle) === "on";
      else if (champ.type === "nombre") settings[champ.cle] = formData.get(champ.cle);
      else if (champ.type === "ancre") settings[champ.cle] = formData.get(champ.cle);
      else if (champ.type === "choix") settings[champ.cle] = formData.get(champ.cle);
      else if (champ.type === "image") {
        const actuelle = lireTexte(section.settings, champ.cle);
        const fichier = formData.get(`fichier-${champ.cle}`);
        const retirer = formData.get(`retirer-${champ.cle}`) === "on";

        if (fichier instanceof File && fichier.size > 0) {
          settings[champ.cle] = await service.deposerImageSection(sectionId, fichier);
          if (actuelle) ancienneImage = actuelle;
        } else if (retirer) {
          settings[champ.cle] = "";
          if (actuelle) ancienneImage = actuelle;
        } else {
          // Ni dépôt ni retrait : l'illustration en place est conservée.
          settings[champ.cle] = actuelle;
        }
      } else settings[champ.cle] = lireBoutonsDuFormulaire(formData, champ.max);
    }

    const input = sectionInputSchema.parse({
      page: section.page,
      type: section.type,
      variant: formData.get("variant"),
      sortOrder: section.sortOrder,
      isVisible: formData.get("isVisible") === "on",
      contentFr,
      contentEn,
      settings,
    });

    await service.enregistrerSection(sectionId, input, acteur);

    /*
     * L'ancien fichier n'est effacé qu'**après** la mise à jour réussie. Dans
     * l'autre ordre, une écriture qui échoue laisserait une section pointant
     * vers un fichier disparu.
     */
    if (ancienneImage) await service.oublierImageSection(ancienneImage);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
  return { avis: "Section enregistrée." };
}

export async function deplacerSectionAction(
  sectionId: string,
  sens: "haut" | "bas",
): Promise<EtatAction> {
  try {
    const { acteur } = await exigerRedaction();
    await service.deplacerSection(sectionId, sens, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
  return {};
}

export async function supprimerSectionAction(sectionId: string): Promise<EtatAction> {
  try {
    const { acteur } = await exigerRedaction();
    await service.supprimerSection(sectionId, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
  return {};
}
