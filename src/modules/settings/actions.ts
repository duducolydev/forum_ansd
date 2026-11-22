"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import * as service from "./service";
import { harmoniserPays } from "./pays-service";
import { lireLienVideo } from "@/modules/medias/video";
import {
  categorieSchema,
  directSchema,
  identiteSchema,
  inscriptionsSchema,
  languesSchema,
  nouvelleCategorieSchema,
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
      titleEn: formData.get("titleEn") ?? "",
      titlePt: formData.get("titlePt") ?? "",
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

export async function enregistrerLanguesAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();
    const valeurs = languesSchema.parse({ portugais: formData.get("portugais") === "on" });
    await service.enregistrerLangues(editionId, valeurs, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  rafraichirToutLePublic();
  return { avis: "Langues enregistrées." };
}

/**
 * Jauges par journée, relevées dans les champs `jauge-AAAA-MM-JJ`.
 *
 * Un champ par journée plutôt qu'un JSON à saisir : le formulaire affiche les
 * journées du Forum, qui dérivent des dates de l'édition. Une journée laissée
 * vide, ou à zéro, n'entre pas dans l'objet — « pas de jauge » et « zéro
 * place » sont la même chose, et c'est l'absence qui fait foi
 * (`modules/dashboard/affluence.ts`).
 */
function jaugesDuFormulaire(formData: FormData): Record<string, number> {
  const jauges: Record<string, number> = {};
  for (const [cle, valeur] of formData.entries()) {
    const jour = cle.startsWith("jauge-") ? cle.slice("jauge-".length) : null;
    if (!jour || !/^\d{4}-\d{2}-\d{2}$/.test(jour)) continue;
    const places = Number(String(valeur).trim());
    if (Number.isInteger(places) && places > 0) jauges[jour] = places;
  }
  return jauges;
}

export async function enregistrerInscriptionsAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();
    const valeurs = inscriptionsSchema.parse({
      active: formData.get("active") === "on",
      validationComite: formData.get("validationComite") === "on",
      ouvertureLe: formData.get("ouvertureLe") ?? "",
      fermetureLe: formData.get("fermetureLe") ?? "",
      messageFermeFr: formData.get("messageFermeFr") ?? undefined,
      messageFermeEn: formData.get("messageFermeEn") ?? undefined,
      messageFermePt: formData.get("messageFermePt") ?? undefined,
      jauges: jaugesDuFormulaire(formData),
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
      destinataireContact: formData.get("destinataireContact") || undefined,
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

/**
 * Réglages du direct.
 *
 * Deux conversions se font ici, et nulle part ailleurs :
 *
 * - **Le lien collé devient un couple fournisseur/identifiant.** C'est la
 *   règle de `modules/medias/video.ts` : on ne remet jamais dans un `iframe`
 *   une adresse saisie telle quelle. Un champ vidé coupe le lecteur sans
 *   dépublier la page — l'intermède prend le relais.
 * - **Les messages se saisissent en trois zones de texte, une par langue, un
 *   message par ligne.** Plus simple à réordonner qu'une liste de champs, et
 *   c'est l'ordre des lignes qui apparie les traductions. Une langue laissée
 *   plus courte retombe sur le français, comme partout sur le site.
 */
export async function enregistrerDirectAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();

    const lien = String(formData.get("lien") ?? "").trim();
    const video = lien ? lireLienVideo(lien) : null;
    if (lien && !video) {
      return {
        erreur:
          "Lien non reconnu : collez l'adresse de la diffusion YouTube (youtube.com/live/…, youtu.be/…) ou Vimeo.",
      };
    }

    const lignes = (champ: string): string[] =>
      String(formData.get(champ) ?? "")
        .split("\n")
        .map((ligne) => ligne.trim())
        .filter((ligne) => ligne.length > 0)
        .slice(0, 12);

    const fr = lignes("messagesFr");
    const en = lignes("messagesEn");
    const pt = lignes("messagesPt");
    const messages = fr.map((texte, rang) => ({
      fr: texte,
      en: en[rang] ?? texte,
      pt: pt[rang] ?? en[rang] ?? texte,
    }));

    const valeurs = directSchema.parse({
      actif: formData.get("actif") === "on",
      video,
      mode: formData.get("mode"),
      margeMinutes: formData.get("margeMinutes"),
      fond: formData.get("fond"),
      messages,
      secondesParMessage: formData.get("secondesParMessage"),
    });
    await service.enregistrerDirect(editionId, valeurs, acteur);
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }

  revalidatePath("/admin/parametres/live");
  revalidatePath("/direct");
  // La page figure dans le menu dès qu'elle est publiée : l'en-tête est rendu
  // par le gabarit public, qu'il faut donc rafraîchir lui aussi.
  rafraichirToutLePublic();
  return { avis: "Diffusion enregistrée." };
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
      labelPt: formData.get("labelPt") ?? "",
      color: formData.get("color") ?? "",
      sortOrder: formData.get("sortOrder") ?? 0,
      isActive: formData.get("isActive") === "on",
      autoConfirm: formData.get("autoConfirm") === "on",
      requiresLogistics: formData.get("requiresLogistics") === "on",
      alertOnScan: formData.get("alertOnScan") === "on",
      requiresAccreditation: formData.get("requiresAccreditation") === "on",
      isPublic: formData.get("isPublic") === "on",
    });
    const { badgesRafraichis } = await service.enregistrerCategorie(
      editionId,
      categoryId,
      valeurs,
      acteur,
    );
    revalidatePath("/admin/parametres/categories");
    revalidatePath("/inscription");
    return {
      avis:
        badgesRafraichis > 0
          ? `Catégorie enregistrée. ${badgesRafraichis} badge(s) en cours de mise à jour, même QR.`
          : "Catégorie enregistrée.",
    };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}

/** Nouvelle catégorie de participants (24 octobre 2026). */
export async function creerCategorieAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur, editionId } = await exigerParametreur();
    const valeurs = nouvelleCategorieSchema.parse({
      code: formData.get("code") ?? "",
      labelFr: formData.get("labelFr"),
      labelEn: formData.get("labelEn"),
      labelPt: formData.get("labelPt") ?? "",
      color: formData.get("color") ?? "",
      sortOrder: formData.get("sortOrder") || 0,
      isActive: true,
      isPublic: formData.get("isPublic") === "on",
      autoConfirm: formData.get("autoConfirm") === "on",
      requiresLogistics: formData.get("requiresLogistics") === "on",
      alertOnScan: formData.get("alertOnScan") === "on",
      requiresAccreditation: formData.get("requiresAccreditation") === "on",
      zonesDepuis: formData.get("zonesDepuis") ?? "TOUTES",
    });
    const { categorie, zones } = await service.creerCategorie(editionId, valeurs, acteur);
    revalidatePath("/admin/parametres/categories");
    revalidatePath("/admin/zones");
    revalidatePath("/inscription");
    return {
      avis: `Catégorie « ${categorie.labelFr} » créée (code ${categorie.code}), ${zones} zone(s) ouverte(s).`,
    };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}

// ---------------------------------------------------------------------------
// Harmonisation des pays (6 novembre 2026)
// ---------------------------------------------------------------------------

/**
 * Remplacements cochés dans Paramètres › Pays. Le formulaire envoie, pour
 * chaque ligne `i`, la valeur actuelle (`de_i`), le pays retenu (`vers_i`) et
 * la case `appliquer_i` ; seules les lignes cochées et pourvues d'un pays sont
 * appliquées.
 */
export async function harmoniserPaysAction(
  _etat: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  try {
    const { acteur } = await exigerParametreur();
    const remplacements: { de: string; vers: string }[] = [];
    for (const [cle, valeur] of formData.entries()) {
      const rang = /^appliquer_(\d+)$/.exec(cle)?.[1];
      if (!rang || valeur !== "on") continue;
      const de = String(formData.get(`de_${rang}`) ?? "");
      const vers = String(formData.get(`vers_${rang}`) ?? "");
      if (de && vers) remplacements.push({ de, vers });
    }
    if (remplacements.length === 0) {
      return { erreur: "Cochez au moins une valeur, avec le pays à retenir." };
    }

    const { valeurs, fiches } = await harmoniserPays(remplacements, acteur);
    revalidatePath("/admin/parametres/pays");
    revalidatePath("/intervenants");
    return {
      avis: `${valeurs} valeur${valeurs > 1 ? "s" : ""} harmonisée${valeurs > 1 ? "s" : ""}, ${fiches} fiche${fiches > 1 ? "s" : ""} mise${fiches > 1 ? "s" : ""} à jour.`,
    };
  } catch (erreur) {
    return { erreur: messageErreur(erreur) };
  }
}
