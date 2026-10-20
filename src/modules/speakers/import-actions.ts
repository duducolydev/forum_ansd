"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { ROLES_SESSION } from "./constantes";
import {
  analyserImport,
  importerIntervenants,
  lireFichier,
  LIGNES_MAX,
  TAILLE_MAX_OCTETS,
  type ErreurLigne,
  type LigneLue,
} from "./import";

/** Ce que l'aperçu montre de chaque ligne retenue. */
export interface LigneApercu {
  rowNumber: number;
  nom: string;
  email: string;
  profil: string;
  seances: string[];
  role: string | null;
  publie: boolean;
  misEnAvant: boolean;
}

export interface EtatApercu {
  /** Lignes lues, renvoyées telles quelles à la confirmation, qui les revérifie. */
  lot?: string;
  lignes?: LigneApercu[];
  erreurs?: ErreurLigne[];
  erreur?: string;
}

export interface EtatConfirmation {
  crees?: number;
  rattachements?: number;
  echecs?: ErreurLigne[];
  erreur?: string;
}

async function exigerImport() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "speakers.write")) throw new Error("Permission refusée.");
  return { acteur: { type: "USER" as const, userId: session.user.id } };
}

/** Étape 1 : lecture et vérification du fichier. Rien n'est écrit. */
export async function apercuImportIntervenantsAction(
  _etat: EtatApercu,
  formData: FormData,
): Promise<EtatApercu> {
  try {
    await exigerImport();

    const fichier = formData.get("fichier");
    if (!(fichier instanceof File) || fichier.size === 0) {
      return { erreur: "Aucun fichier sélectionné." };
    }
    if (fichier.size > TAILLE_MAX_OCTETS) {
      return { erreur: "Fichier trop volumineux (2 Mo au plus)." };
    }

    const lues = lireFichier(Buffer.from(await fichier.arrayBuffer()));
    if (lues.length === 0) {
      return {
        erreur:
          "Aucune ligne reconnue. Vérifiez que la première ligne porte les en-têtes du modèle (prenom, nom, email…).",
      };
    }
    if (lues.length > LIGNES_MAX) {
      return { erreur: `Trop de lignes (${lues.length}) : ${LIGNES_MAX} au plus par fichier.` };
    }

    const edition = await getActiveEdition();
    const { valides, erreurs } = await analyserImport(edition.id, lues);

    // Seules les lignes retenues repartent vers le navigateur ; la
    // confirmation les revérifie toutes.
    const retenues = new Set(valides.map((ligne) => ligne.rowNumber));
    const lot: LigneLue[] = lues.filter((ligne) => retenues.has(ligne.rowNumber));

    return {
      lot: Buffer.from(JSON.stringify(lot)).toString("base64"),
      lignes: valides.map((ligne) => ({
        rowNumber: ligne.rowNumber,
        nom: `${ligne.input.firstName} ${ligne.input.lastName}`,
        email: ligne.input.email ?? "",
        profil: [ligne.input.jobTitle, ligne.input.organization, ligne.input.country]
          .filter(Boolean)
          .join(" · "),
        seances: ligne.seances.map((seance) => seance.titre),
        role: ligne.seances.length > 0 ? ROLES_SESSION[ligne.role] : null,
        publie: ligne.input.isPublished,
        misEnAvant: ligne.input.isFeatured,
      })),
      erreurs,
    };
  } catch (erreur) {
    return { erreur: (erreur as Error).message };
  }
}

function lireLot(valeur: FormDataEntryValue | null): LigneLue[] {
  const lot: unknown = JSON.parse(Buffer.from(String(valeur ?? ""), "base64").toString("utf-8"));
  if (!Array.isArray(lot) || lot.length > LIGNES_MAX) throw new Error("Lot d'import invalide.");
  return lot.map((ligne) => {
    const { rowNumber, valeurs } = ligne as { rowNumber: unknown; valeurs: unknown };
    if (typeof rowNumber !== "number" || !valeurs || typeof valeurs !== "object") {
      throw new Error("Lot d'import invalide.");
    }
    return {
      rowNumber,
      valeurs: Object.fromEntries(
        Object.entries(valeurs as Record<string, unknown>).map(([cle, v]) => [cle, String(v)]),
      ),
    };
  });
}

/** Étape 2 : revérification, puis création des fiches et rattachement aux séances. */
export async function confirmerImportIntervenantsAction(
  _etat: EtatConfirmation,
  formData: FormData,
): Promise<EtatConfirmation> {
  try {
    const { acteur } = await exigerImport();
    let lot: LigneLue[];
    try {
      lot = lireLot(formData.get("lot"));
    } catch {
      return { erreur: "Import expiré ou altéré : rechargez le fichier." };
    }

    const edition = await getActiveEdition();
    // Revérification : entre l'aperçu et la confirmation, une fiche a pu être
    // créée à la main, ou une séance supprimée.
    const { valides, erreurs } = await analyserImport(edition.id, lot);
    const bilan = await importerIntervenants(edition.id, valides, acteur);

    revalidatePath("/admin/intervenants");
    revalidatePath("/intervenants");
    revalidatePath("/programme");
    revalidatePath("/programme/[slug]", "page");
    return {
      crees: bilan.crees,
      rattachements: bilan.rattachements,
      echecs: [...erreurs, ...bilan.echecs].sort((a, b) => a.rowNumber - b.rowNumber),
    };
  } catch (erreur) {
    return { erreur: (erreur as Error).message };
  }
}
