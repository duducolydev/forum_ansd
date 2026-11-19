"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { marquerExportes, type FiltreBadges } from "./bulk";
import {
  mettreEnFileEnLot,
  perimetreSchema,
  revoquerEnLot,
  type ModeGeneration,
  type PerimetreLot,
  type ResultatLotBadges,
} from "./lot";

export interface BulkState {
  error?: string;
  resultat?: ResultatLotBadges;
}

export interface MarquageState {
  error?: string;
  marques?: number;
}

function premierMessage(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

/**
 * Génération, régénération ou passage au gabarit en vigueur.
 *
 * Le périmètre vient de l'écran : tout le filtre, ou les lignes cochées
 * (`lot.ts`). Les deux sont servis par la même action, pour qu'une règle ne
 * puisse pas valoir d'un côté et pas de l'autre.
 */
export async function genererEnLotAction(
  perimetre: PerimetreLot,
  mode: ModeGeneration,
): Promise<BulkState> {
  const session = await auth();
  if (!can(session, "badges.generate")) return { error: "Permission refusée." };

  try {
    const verifie = perimetreSchema.parse(perimetre);
    const edition = await getActiveEdition();
    const resultat = await mettreEnFileEnLot(edition.id, verifie, mode, {
      type: "USER",
      userId: session?.user?.id,
    });

    revalidatePath("/admin/badges");
    return { resultat };
  } catch (error) {
    return { error: premierMessage(error) };
  }
}

/**
 * Déclare le filtre courant comme déjà parti à l'impression, sans produire
 * d'archive (`bulk.ts`, `marquerExportes`).
 *
 * Sert à rattraper les envois antérieurs au 19 novembre 2026, dont la base n'a
 * gardé aucune trace nominative. Volontairement limité au **filtre** et non à
 * la sélection : on déclare un envoi passé, qui portait sur un périmètre, pas
 * sur trois lignes cochées à la main.
 */
export async function marquerExportesAction(filtre: FiltreBadges): Promise<MarquageState> {
  const session = await auth();
  if (!can(session, "badges.print")) return { error: "Permission refusée." };

  try {
    const edition = await getActiveEdition();
    const marques = await marquerExportes(edition.id, filtre, session?.user?.id);

    revalidatePath("/admin/badges");
    return { marques };
  } catch (error) {
    return { error: premierMessage(error) };
  }
}

/**
 * Crée un stock de cartes anonymes pour une catégorie, et met leur rendu en
 * file (`anonymes.ts`).
 *
 * Même permission que la génération ordinaire : ces cartes ouvrent les mêmes
 * portes, et rien ne justifierait qu'elles soient plus faciles à produire.
 */
export async function creerBadgesAnonymesAction(
  categoryId: string,
  nombre: number,
): Promise<MarquageState & { references?: string[] }> {
  const session = await auth();
  if (!can(session, "badges.generate")) return { error: "Permission refusée." };

  try {
    const edition = await getActiveEdition();
    const { creerBadgesAnonymes } = await import("./anonymes");
    const { enqueueBadgesAnonymes } = await import("./jobs");
    const { ids, references } = await creerBadgesAnonymes(edition.id, categoryId, nombre, {
      type: "USER",
      userId: session?.user?.id,
    });

    await enqueueBadgesAnonymes(ids);

    revalidatePath("/admin/badges");
    return { marques: ids.length, references };
  } catch (error) {
    return { error: premierMessage(error) };
  }
}

/** Révocation du périmètre : tout le filtre, ou les lignes cochées. */
export async function revoquerEnLotAction(
  perimetre: PerimetreLot,
  motif: string,
): Promise<BulkState> {
  const session = await auth();
  if (!can(session, "badges.revoke")) return { error: "Permission refusée." };

  try {
    const verifie = perimetreSchema.parse(perimetre);
    if (!motif.trim()) return { error: "Un motif de révocation est requis." };
    const edition = await getActiveEdition();
    const resultat = await revoquerEnLot(edition.id, verifie, motif.trim(), {
      type: "USER",
      userId: session?.user?.id,
    });

    revalidatePath("/admin/badges");
    return { resultat };
  } catch (error) {
    return { error: premierMessage(error) };
  }
}
