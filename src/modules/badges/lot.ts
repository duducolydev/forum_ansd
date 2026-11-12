import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { enqueueBadgeGeneration, type Actor } from "@/modules/participants/service";
import { aRefaireAuGabarit, perimetreFiltre, type FiltreBadges } from "./bulk";
import { GABARIT_BADGE } from "./format";
import { enqueueBadgeReissueRender, enqueueBadgeRefresh } from "./jobs";
import { prepareReissue, revokeBadge } from "./service";

/**
 * Actions de masse sur les badges, depuis la liste du BackOffice
 * (12 novembre 2026).
 *
 * **Deux périmètres, les mêmes actions.** Un geste porte soit sur tout ce que
 * le filtre affiche — c'est ainsi qu'on traite « toute la délégation du Mali »
 * sans cocher deux cents lignes —, soit sur les seules lignes cochées, pour
 * viser plus fin à l'intérieur de ce filtre. Les deux chemins passent par les
 * mêmes fonctions, de sorte qu'une règle (statut badgeable, badge déjà
 * révoqué) ne puisse pas valoir d'un côté et pas de l'autre.
 *
 * Chaque badge passe par **la fonction de la fiche** — `revokeBadge`,
 * `enqueueBadgeGeneration`, `enqueueBadgeRefresh` — et donc par les mêmes
 * règles, les mêmes e-mails et la même trace d'audit. Une cible refusée
 * n'arrête pas le lot : elle est mise de côté avec sa raison.
 */

/**
 * Plafond d'un lot. Les mises en file sont bornées haut car elles ne coûtent
 * qu'une ligne de file ; la révocation écrit en base et journalise badge par
 * badge, et une passe de mille suffit largement au plus gros geste réel.
 */
export const LOT_BADGES_MAX = 1000;

/** Ce sur quoi porte l'action : tout le filtre, ou les lignes cochées. */
export type PerimetreLot =
  { mode: "filtre"; filtre: FiltreBadges } | { mode: "selection"; participantIds: string[] };

const filtreSchema = z.object({
  categoryId: z.string().min(1).optional(),
  delegationId: z.string().min(1).optional(),
  etat: z.enum(["SANS", "AVEC", "REVOQUE"]).optional(),
});

export const perimetreSchema: z.ZodType<PerimetreLot> = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("filtre"), filtre: filtreSchema }),
  z.object({
    mode: z.literal("selection"),
    participantIds: z
      .array(z.string().min(1))
      .min(1, "Aucune ligne sélectionnée.")
      .max(LOT_BADGES_MAX),
  }),
]);

/** Ce que fait une mise en file, et sur quelles lignes elle porte. */
export type ModeGeneration =
  /** Les participants sans aucun badge : première génération, avec e-mail. */
  | "manquants"
  /** Les badges valides, refaits dans leur version : même QR, sans e-mail. */
  | "existants"
  /** Les seuls badges valides rendus avec un gabarit antérieur. */
  | "ancien-gabarit"
  /** Les badges révoqués : version+1, **nouveau QR**, avec e-mail. */
  | "reemission";

export interface ResultatLotBadges {
  traites: number;
  /** Les premières cibles mises de côté, avec leur raison : de quoi comprendre. */
  ignores: { nom: string; raison: string }[];
  /** Total mis de côté, détaillé ou non. */
  ignoresTotal: number;
  /** Cibles au-delà du plafond, à reprendre en relançant l'action. */
  reste: number;
}

/** Au-delà, la liste des mises de côté encombre l'écran plus qu'elle n'informe. */
const DETAILS_MAX = 20;

interface CibleLot {
  participantId: string;
  nom: string;
  badgeId: string | null;
  badgeRevoque: boolean;
  badgeGenere: boolean;
}

/**
 * Participants visés, dans l'ordre de la liste.
 *
 * Le périmètre est **toujours recalculé en base**, jamais déduit de ce que le
 * navigateur annonce : une sélection vieille de dix minutes peut porter sur
 * des badges révoqués depuis, et des identifiants reçus d'un client ne disent
 * rien de l'édition à laquelle ils appartiennent.
 */
async function cibles(
  editionId: string,
  perimetre: PerimetreLot,
  restriction: Prisma.ParticipantWhereInput,
  plafond: number,
): Promise<{ lignes: CibleLot[]; reste: number }> {
  const base =
    perimetre.mode === "filtre"
      ? perimetreFiltre(editionId, perimetre.filtre)
      : {
          ...perimetreFiltre(editionId, {}),
          id: { in: [...new Set(perimetre.participantIds)] },
        };

  const participants = await prisma.participant.findMany({
    where: { AND: [base, restriction] },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    // Une de plus que le plafond : c'est ce qui permet de dire « il en reste ».
    take: plafond + 1,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      badges: {
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, version: true, generatedAt: true, revokedAt: true },
      },
    },
  });

  const lignes = participants.slice(0, plafond).map((participant) => {
    const badge = participant.badges[0];
    return {
      participantId: participant.id,
      nom: `${participant.lastName.toUpperCase()} ${participant.firstName}`,
      badgeId: badge?.id ?? null,
      badgeRevoque: badge?.revokedAt != null,
      badgeGenere: Boolean(badge?.generatedAt) && badge?.revokedAt == null,
    };
  });

  return { lignes, reste: Math.max(0, participants.length - plafond) };
}

/** Sélection d'un badge valide, généré ou non — ce qui se révoque. */
const AVEC_BADGE_VALIDE: Prisma.ParticipantWhereInput = { badges: { some: { revokedAt: null } } };

/** Restriction propre à chaque mode de mise en file. */
function restrictionDe(editionId: string, mode: ModeGeneration, perimetre: PerimetreLot) {
  if (mode === "manquants") {
    // Même définition que l'état « À générer » de l'écran (`bulk.ts`) : un
    // badge révoqué n'en est pas, il relève de la réémission.
    return {
      badges: { none: { OR: [{ revokedAt: { not: null } }, { generatedAt: { not: null } }] } },
    };
  }
  if (mode === "reemission") {
    // Plus aucun badge valide, et au moins un révoqué : exactement l'état
    // « Révoqué » de l'écran.
    return { badges: { some: { revokedAt: { not: null } }, none: { revokedAt: null } } };
  }
  if (mode === "existants") {
    return { badges: { some: { revokedAt: null, generatedAt: { not: null } } } };
  }
  // Le repérage du gabarit vit dans `bulk.ts`, au plus près du compteur qui
  // l'affiche ; appliqué ici à l'intérieur du périmètre, filtre ou sélection.
  const filtre = perimetre.mode === "filtre" ? perimetre.filtre : {};
  return aRefaireAuGabarit(editionId, { ...filtre, etat: undefined });
}

function resultat(
  traites: number,
  ignores: { nom: string; raison: string }[],
  reste: number,
): ResultatLotBadges {
  return { traites, ignores: ignores.slice(0, DETAILS_MAX), ignoresTotal: ignores.length, reste };
}

/**
 * Met en file la génération ou le rafraîchissement du périmètre.
 *
 * Rien n'est rendu ici : rendre 500 badges prend deux à trois minutes
 * (`pnpm bench:badges`), ce qu'aucune requête HTTP ne doit attendre. L'écran
 * annonce donc une **mise en file**, et le worker suit à son rythme.
 */
export async function mettreEnFileEnLot(
  editionId: string,
  perimetre: PerimetreLot,
  mode: ModeGeneration,
  actor: Actor,
): Promise<ResultatLotBadges> {
  const { lignes, reste } = await cibles(
    editionId,
    perimetre,
    restrictionDe(editionId, mode, perimetre),
    LOT_BADGES_MAX,
  );

  const ignores: { nom: string; raison: string }[] = [];
  let traites = 0;

  for (const cible of lignes) {
    // Un badge révoqué ne se **régénère** pas : sa version est morte avec lui,
    // il faut en émettre une nouvelle. C'est le mode `reemission`, pas les
    // autres, que `generateBadge` refuserait d'ailleurs.
    if (cible.badgeRevoque && mode !== "reemission") {
      ignores.push({ nom: cible.nom, raison: "badge révoqué : passez par la réémission" });
      continue;
    }
    if (!cible.badgeRevoque && mode === "reemission") {
      ignores.push({ nom: cible.nom, raison: "a déjà un badge valide : rien à réémettre" });
      continue;
    }

    try {
      if (mode === "reemission") {
        /*
         * La version suivante est créée ici, le rendu part en file : deux
         * cents rendus dans la requête tiendraient la minute et demie. Le
         * motif de la ligne révoquée reste le sien — on ne révoque rien de
         * plus, on émet la suite.
         */
        const badge = await prepareReissue(cible.participantId, "", actor);
        await enqueueBadgeReissueRender(cible.participantId, badge.version);
        traites += 1;
      } else if (mode === "manquants") {
        await enqueueBadgeGeneration(cible.participantId);
        traites += 1;
      } else if (await enqueueBadgeRefresh(cible.participantId, { silencieux: true })) {
        traites += 1;
      } else {
        // Le badge a été révoqué ou supprimé entre la liste et le clic.
        ignores.push({ nom: cible.nom, raison: "plus de badge valide à refaire" });
      }
    } catch (error) {
      ignores.push({
        nom: cible.nom,
        raison: error instanceof Error ? error.message : "erreur inattendue",
      });
    }
  }

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action:
      mode === "ancien-gabarit"
        ? "badge.bulk_reformat"
        : mode === "reemission"
          ? "badge.bulk_reissue"
          : "badge.bulk_generate",
    entity: "Edition",
    entityId: editionId,
    after: {
      mode,
      perimetre: perimetre.mode,
      ...(perimetre.mode === "filtre" ? { filtre: perimetre.filtre } : { coches: lignes.length }),
      misEnFile: traites,
      ignores: ignores.length,
      reste,
      ...(mode === "ancien-gabarit" ? { gabarit: GABARIT_BADGE } : {}),
    },
  });

  return resultat(traites, ignores, reste);
}

/**
 * Révoque le badge valide de chaque cible du périmètre.
 *
 * Il n'y a **pas de réémission en lot** : elle change le QR de chacun et
 * relance un rendu puis un e-mail par personne, ce qui se décide fiche par
 * fiche. Ici on retire des droits d'accès, rien de plus.
 */
export async function revoquerEnLot(
  editionId: string,
  perimetre: PerimetreLot,
  motif: string,
  actor: Actor,
): Promise<ResultatLotBadges> {
  const { lignes, reste } = await cibles(editionId, perimetre, AVEC_BADGE_VALIDE, LOT_BADGES_MAX);

  const ignores: { nom: string; raison: string }[] = [];
  let traites = 0;

  for (const cible of lignes) {
    if (!cible.badgeId || cible.badgeRevoque) {
      ignores.push({ nom: cible.nom, raison: "n'a plus de badge valide" });
      continue;
    }

    try {
      await revokeBadge(cible.badgeId, motif, actor);
      traites += 1;
    } catch (error) {
      ignores.push({
        nom: cible.nom,
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
      perimetre: perimetre.mode,
      ...(perimetre.mode === "filtre" ? { filtre: perimetre.filtre } : { coches: lignes.length }),
      revoques: traites,
      ignores,
      reste,
      motif,
    },
  });

  return resultat(traites, ignores, reste);
}
