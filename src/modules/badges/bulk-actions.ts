"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getActiveEdition } from "@/lib/edition";
import { genererEnLot, refaireAuGabaritEnLot, type FiltreBadges } from "./bulk";
import { lotRevocationSchema, revoquerEnLot, type ResultatRevocationLot } from "./lot";

export interface BulkState {
  error?: string;
  message?: string;
}

function premierMessage(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues: { message: string }[] }).issues;
    if (issues?.[0]) return issues[0].message;
  }
  return error instanceof Error ? error.message : "Une erreur est survenue.";
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

/** Passage des badges déjà rendus au gabarit en vigueur (`format.ts`). */
export async function refaireAuGabaritAction(filtre: FiltreBadges): Promise<BulkState> {
  const session = await auth();
  if (!can(session, "badges.generate")) return { error: "Permission refusée." };

  try {
    const edition = await getActiveEdition();
    const { misEnFile } = await refaireAuGabaritEnLot(edition.id, filtre, session?.user?.id);

    revalidatePath("/admin/badges");
    if (misEnFile === 0) {
      return { message: "Tous les badges de ce périmètre ont déjà la nouvelle maquette." };
    }
    return {
      message: `${misEnFile} badge(s) mis en file pour la nouvelle maquette. Même QR, aucun e-mail envoyé ; actualisez pour suivre.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Une erreur est survenue." };
  }
}

/**
 * Révocation des badges cochés dans la liste (`lot.ts`).
 *
 * Le périmètre est la **sélection explicite**, pas le filtre : les autres
 * boutons de cet écran agissent sur tout le filtre, mais invalider des droits
 * d'accès ne doit jamais porter sur des lignes qu'on n'a pas vues.
 */
export async function revoquerEnLotAction(
  badgeIds: string[],
  motif: string,
): Promise<BulkState & { resultat?: ResultatRevocationLot }> {
  const session = await auth();
  if (!can(session, "badges.revoke")) return { error: "Permission refusée." };

  try {
    const lot = lotRevocationSchema.parse({ badgeIds, motif });
    const edition = await getActiveEdition();
    const resultat = await revoquerEnLot(edition.id, lot.badgeIds, lot.motif, {
      type: "USER",
      userId: session?.user?.id,
    });

    revalidatePath("/admin/badges");
    return { resultat };
  } catch (error) {
    return { error: premierMessage(error) };
  }
}
