"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { genererEnLot, remettreAuFormatEnLot, type FiltreBadges } from "./bulk";

export interface BulkState {
  error?: string;
  message?: string;
}

export async function genererEnLotAction(filtre: FiltreBadges): Promise<BulkState> {
  const session = await auth();
  if (!can(session, "badges.generate")) return { error: "Permission refusée." };

  try {
    const edition = await getActiveEdition();
    const { misEnFile } = await genererEnLot(edition.id, filtre, session?.user?.id);

    revalidatePath("/admin/badges");
    if (misEnFile === 0) {
      return { message: "Tous les badges de ce périmètre sont déjà générés." };
    }
    return {
      // On annonce une mise en file, pas une génération : le rendu se fait en
      // arrière-plan, et dire « générés » ferait chercher des fichiers qui
      // n'existent pas encore.
      message: `${misEnFile} badge(s) mis en file. Le rendu se poursuit en arrière-plan ; actualisez pour suivre.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." };
  }
}

/** Passage au grand format (25 octobre 2026) des badges déjà rendus. */
export async function remettreAuFormatAction(filtre: FiltreBadges): Promise<BulkState> {
  const session = await auth();
  if (!can(session, "badges.generate")) return { error: "Permission refusée." };

  try {
    const edition = await getActiveEdition();
    const { misEnFile } = await remettreAuFormatEnLot(edition.id, filtre, session?.user?.id);

    revalidatePath("/admin/badges");
    if (misEnFile === 0) {
      return { message: "Tous les badges de ce périmètre sont déjà au format 100 × 150 mm." };
    }
    return {
      message: `${misEnFile} badge(s) mis en file pour le format 100 × 150 mm. Même QR, aucun e-mail envoyé ; actualisez pour suivre.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." };
  }
}
