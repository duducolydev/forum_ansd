import { rm } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../../src/lib/db";
import { E2E_PREFIX } from "./comptes";

/**
 * Suppression des données créées par les tests.
 *
 * Les tests écrivent dans la **vraie** base — c'est le prix d'un test de bout
 * en bout honnête. Ils ne laissent donc rien derrière eux, faute de quoi les
 * comptages du tableau de bord dériveraient à chaque exécution.
 */
export async function nettoyerDonneesE2E(): Promise<void> {
  const participants = await prisma.participant.findMany({
    where: { email: { startsWith: E2E_PREFIX } },
    select: { id: true, publicId: true },
  });

  if (participants.length > 0) {
    // Les badges et journaux partent en cascade avec le participant ; restent
    // les fichiers, hors base.
    await prisma.participant.deleteMany({
      where: { id: { in: participants.map((p) => p.id) } },
    });

    const racine = process.env.STORAGE_LOCAL_PATH ?? "./storage";
    for (const participant of participants) {
      await rm(join(racine, "badges", participant.publicId), {
        recursive: true,
        force: true,
      }).catch(() => undefined);
    }
  }

  await prisma.invitation.deleteMany({ where: { email: { startsWith: E2E_PREFIX } } });
}
