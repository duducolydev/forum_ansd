import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { Actor } from "@/modules/participants/service";
import { revokeBadge } from "./service";

/**
 * Révocation de plusieurs badges en une passe (12 novembre 2026), depuis la
 * liste des badges du BackOffice.
 *
 * Chaque badge passe par **la même fonction** que le bouton de la fiche
 * (`revokeBadge`) : même horodatage, même motif enregistré, même trace
 * d'audit. Un badge déjà révoqué entre-temps n'arrête pas le lot : il est mis
 * de côté avec sa raison, et les autres suivent.
 *
 * Il n'y a **pas** de réémission en lot : réémettre relance un rendu et un
 * e-mail par personne, et surtout cela change le QR de chacune — un geste qui
 * se décide fiche par fiche. Ici on retire des droits d'accès, rien de plus.
 */

/** Une page de la liste au plus : c'est ce qu'on peut cocher d'un coup. */
export const LOT_BADGES_MAX = 200;

export const lotRevocationSchema = z.object({
  badgeIds: z
    .array(z.string().min(1))
    .min(1, "Aucun badge sélectionné.")
    .max(LOT_BADGES_MAX, `${LOT_BADGES_MAX} badges au plus par lot.`),
  motif: z.string().trim().min(1, "Un motif de révocation est requis."),
});

export interface ResultatRevocationLot {
  revoques: number;
  /** Badges laissés de côté, avec le nom à montrer et la raison. */
  ignores: { badgeId: string; nom: string; raison: string }[];
}

export async function revoquerEnLot(
  editionId: string,
  badgeIds: string[],
  motif: string,
  actor: Actor,
): Promise<ResultatRevocationLot> {
  const uniques = [...new Set(badgeIds)].slice(0, LOT_BADGES_MAX);

  // Les identifiants viennent du navigateur : on ne révoque que des badges de
  // l'édition en cours, et on relit `revokedAt` en base plutôt que de croire
  // l'état affiché, qui peut avoir quelques minutes.
  const cibles = await prisma.badge.findMany({
    where: { id: { in: uniques }, participant: { editionId } },
    select: {
      id: true,
      version: true,
      revokedAt: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  });

  const resultat: ResultatRevocationLot = { revoques: 0, ignores: [] };
  const connus = new Set(cibles.map((badge) => badge.id));

  for (const badgeId of uniques) {
    if (!connus.has(badgeId)) {
      resultat.ignores.push({
        badgeId,
        nom: badgeId,
        raison: "badge introuvable dans cette édition",
      });
    }
  }

  for (const badge of cibles) {
    const nom = `${badge.participant.lastName.toUpperCase()} ${badge.participant.firstName} (v${badge.version})`;

    if (badge.revokedAt) {
      resultat.ignores.push({ badgeId: badge.id, nom, raison: "était déjà révoqué" });
      continue;
    }

    try {
      await revokeBadge(badge.id, motif, actor);
      resultat.revoques += 1;
    } catch (error) {
      resultat.ignores.push({
        badgeId: badge.id,
        nom,
        raison: error instanceof Error ? error.message : "erreur inattendue",
      });
    }
  }

  // Une trace pour le geste, en plus de celle de chaque révocation : retrouver
  // qui a invalidé trente badges d'un clic ne doit pas demander de recouper
  // trente lignes.
  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "badge.bulk_revoke",
    entity: "Badge",
    entityId: "lot",
    after: {
      demandes: uniques.length,
      revoques: resultat.revoques,
      ignores: resultat.ignores,
      motif,
    },
  });

  return resultat;
}
