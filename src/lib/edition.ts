import { prisma } from "./db";

/**
 * L'édition active (D1 : le portail est multi-édition, mais une seule édition
 * est "en cours" à la fois). Utilisé par tous les modules pour scoper leurs
 * requêtes — cf. brief §4 : « Toutes les tables métier portent editionId ».
 */
export async function getActiveEdition() {
  const edition = await prisma.edition.findFirst({ where: { isActive: true } });
  if (!edition) {
    throw new Error("Aucune édition active — vérifier la table Edition (cf. prisma/seed.ts).");
  }
  return edition;
}
