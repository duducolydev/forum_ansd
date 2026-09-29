"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import {
  analyserImport,
  importerParticipants,
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
  categorie: string;
  pays: string;
  organisation: string;
  delegation: string | null;
  jours: string;
  presse: boolean;
}

export interface EtatApercu {
  /** Lignes lues, renvoyées telles quelles à la confirmation, qui les revérifie. */
  lot?: string;
  lignes?: LigneApercu[];
  erreurs?: ErreurLigne[];
  erreur?: string;
}

export interface EtatConfirmation {
  inscrits?: number;
  echecs?: ErreurLigne[];
  erreur?: string;
}

async function exigerImport() {
  const session = await auth();
  if (!session?.user) throw new Error("Non authentifié.");
  if (!can(session, "participants.import")) throw new Error("Permission refusée.");
  return {
    acteur: { type: "USER" as const, userId: session.user.id },
    peutAccrediter: can(session, "participants.accredit"),
  };
}

function jours(input: {
  attendsOpening: boolean;
  attendsClosing: boolean;
  attendsAwards: boolean;
}): string {
  const liste = [
    input.attendsOpening && "Ouverture",
    input.attendsAwards && "Distinction",
    input.attendsClosing && "Clôture",
  ].filter(Boolean);
  return liste.length > 0 ? liste.join(", ") : "—";
}

/** Étape 1 : lecture et vérification du fichier. Rien n'est écrit. */
export async function apercuImportAction(
  _etat: EtatApercu,
  formData: FormData,
): Promise<EtatApercu> {
  try {
    const { peutAccrediter } = await exigerImport();

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
          "Aucune ligne reconnue. Vérifiez que la première ligne porte les en-têtes du modèle (prenom, nom, email, pays, categorie…).",
      };
    }
    if (lues.length > LIGNES_MAX) {
      return { erreur: `Trop de lignes (${lues.length}) : ${LIGNES_MAX} au plus par fichier.` };
    }

    const edition = await getActiveEdition();
    const { valides, erreurs } = await analyserImport(edition.id, lues, { peutAccrediter });

    // Seules les lignes retenues repartent vers le navigateur ; la
    // confirmation les revérifie toutes.
    const retenues = new Set(valides.map((ligne) => ligne.rowNumber));
    const lot: LigneLue[] = lues.filter((ligne) => retenues.has(ligne.rowNumber));

    return {
      lot: Buffer.from(JSON.stringify(lot)).toString("base64"),
      lignes: valides.map((ligne) => ({
        rowNumber: ligne.rowNumber,
        nom: [ligne.input.civility, ligne.input.firstName, ligne.input.lastName]
          .filter(Boolean)
          .join(" "),
        email: ligne.input.email,
        categorie: ligne.categorie,
        pays: ligne.input.country,
        organisation: ligne.input.organization ?? "",
        delegation: ligne.delegation,
        jours: jours(ligne.input),
        presse: ligne.presse,
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

/** Étape 2 : revérification, puis inscription et e-mails. */
export async function confirmerImportAction(
  _etat: EtatConfirmation,
  formData: FormData,
): Promise<EtatConfirmation> {
  try {
    const { acteur, peutAccrediter } = await exigerImport();
    let lot: LigneLue[];
    try {
      lot = lireLot(formData.get("lot"));
    } catch {
      return { erreur: "Import expiré ou altéré : rechargez le fichier." };
    }

    const edition = await getActiveEdition();
    // Revérification : entre l'aperçu et la confirmation, quelqu'un a pu
    // s'inscrire en ligne avec la même adresse.
    const { valides, erreurs } = await analyserImport(edition.id, lot, { peutAccrediter });
    const bilan = await importerParticipants(edition, valides, acteur, { peutAccrediter });

    revalidatePath("/admin/participants");
    return {
      inscrits: bilan.inscrits,
      echecs: [...erreurs, ...bilan.echecs].sort((a, b) => a.rowNumber - b.rowNumber),
    };
  } catch (erreur) {
    return { erreur: (erreur as Error).message };
  }
}
