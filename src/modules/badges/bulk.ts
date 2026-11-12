import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { creerZip, nomSur, type EntreeZip } from "@/lib/zip";
import { GABARIT_BADGE, auGabaritCourant } from "./format";

/**
 * Périmètre, liste et export de badges en lot (brief §5.4).
 *
 * Ce fichier décrit **ce que le filtre de l'écran désigne** — les participants
 * visés, leur état, ce qu'on en montre et ce qu'on en exporte. Les gestes qui
 * agissent sur ce périmètre (générer, refaire, révoquer) vivent dans
 * `lot.ts`, qui réutilise `perimetreFiltre` pour travailler exactement sur les
 * mêmes lignes que la liste.
 */

export interface FiltreBadges {
  categoryId?: string;
  delegationId?: string;
  /** `SANS` : pas encore de badge ; `AVEC` : badge valide ; `REVOQUE` : à réémettre. */
  etat?: "SANS" | "AVEC" | "REVOQUE";
}

/** Seuls ces statuts ont droit à un badge (brief §5.4). */
const STATUTS_BADGEABLES: Prisma.ParticipantWhereInput["status"] = {
  in: ["CONFIRMED", "BADGED", "CHECKED_IN"],
};

/**
 * Participants visés par le filtre de l.écran, exporté pour que les actions de
 * lot (`lot.ts`) travaillent exactement sur le même périmètre que la liste.
 */
export function perimetreFiltre(
  editionId: string,
  filtre: FiltreBadges,
): Prisma.ParticipantWhereInput {
  const base: Prisma.ParticipantWhereInput = {
    editionId,
    deletedAt: null,
    status: STATUTS_BADGEABLES,
    ...(filtre.categoryId ? { categoryId: filtre.categoryId } : {}),
    ...(filtre.delegationId ? { delegationId: filtre.delegationId } : {}),
  };

  if (filtre.etat === "SANS") {
    /*
     * Aucun badge, ou un badge créé mais pas encore rendu : les deux se
     * traitent de la même façon, il faut lancer une génération.
     *
     * Un badge **révoqué** n'en fait pas partie, bien qu'il ne laisse lui non
     * plus aucun badge valide : il se réémet (version+1, nouveau QR), il ne se
     * génère pas. Les trois états forment ainsi une partition, et l'écran ne
     * peut plus annoncer « 6 sans badge » en face d'un bouton « Générer 0 ».
     */
    return {
      ...base,
      badges: { none: { OR: [{ revokedAt: { not: null } }, { generatedAt: { not: null } }] } },
    };
  }
  if (filtre.etat === "AVEC") {
    return { ...base, badges: { some: { revokedAt: null, generatedAt: { not: null } } } };
  }
  if (filtre.etat === "REVOQUE") {
    return {
      ...base,
      badges: { some: { revokedAt: { not: null } }, none: { revokedAt: null } },
    };
  }
  return base;
}

export interface LigneBadge {
  participantId: string;
  publicId: string;
  nom: string;
  categorie: string;
  delegation: string | null;
  badgeId: string | null;
  version: number | null;
  genere: boolean;
  revoque: boolean;
  /** Badge valide rendu avec un gabarit antérieur, donc à refaire (`format.ts`). */
  ancienGabarit: boolean;
  impressions: number;
}

export async function lister(
  editionId: string,
  filtre: FiltreBadges,
  limite = 200,
): Promise<LigneBadge[]> {
  const participants = await prisma.participant.findMany({
    where: perimetreFiltre(editionId, filtre),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: limite,
    select: {
      id: true,
      publicId: true,
      firstName: true,
      lastName: true,
      category: { select: { labelFr: true } },
      delegation: { select: { name: true } },
      badges: {
        orderBy: { version: "desc" },
        take: 1,
        select: {
          id: true,
          version: true,
          generatedAt: true,
          revokedAt: true,
          printedCount: true,
          pngPath: true,
        },
      },
    },
  });

  return participants.map((participant) => {
    const badge = participant.badges[0];
    return {
      participantId: participant.id,
      publicId: participant.publicId,
      nom: `${participant.lastName.toUpperCase()} ${participant.firstName}`,
      categorie: participant.category.labelFr,
      delegation: participant.delegation?.name ?? null,
      badgeId: badge?.id ?? null,
      version: badge?.version ?? null,
      genere: Boolean(badge?.generatedAt),
      revoque: badge?.revokedAt != null,
      ancienGabarit:
        Boolean(badge?.generatedAt) &&
        badge?.revokedAt == null &&
        !auGabaritCourant(badge?.pngPath ?? null),
      impressions: badge?.printedCount ?? 0,
    };
  });
}

export async function compter(editionId: string, filtre: FiltreBadges): Promise<number> {
  return prisma.participant.count({ where: perimetreFiltre(editionId, filtre) });
}

/**
 * Badges valides rendus avec un gabarit antérieur — la carte CR80, le premier
 * 100 × 150 mm —, repérés au nom de leur fichier (`format.ts`).
 */
export function aRefaireAuGabarit(
  editionId: string,
  filtre: FiltreBadges,
): Prisma.ParticipantWhereInput {
  return {
    ...perimetreFiltre(editionId, { ...filtre, etat: undefined }),
    badges: {
      some: {
        revokedAt: null,
        generatedAt: { not: null },
        NOT: { pngPath: { contains: `-${GABARIT_BADGE}.` } },
      },
    },
  };
}

export async function compterAncienGabarit(
  editionId: string,
  filtre: FiltreBadges,
): Promise<number> {
  return prisma.participant.count({ where: aRefaireAuGabarit(editionId, filtre) });
}

export interface ArchiveBadges {
  fichier: Buffer;
  nom: string;
  inclus: number;
  /** Badges attendus mais dont le PDF manquait encore. */
  manquants: number;
}

/**
 * Archive ZIP des PDF, rangés **par délégation** (brief §5.4).
 *
 * Un dossier par délégation, plus un dossier « Sans délégation » : c'est ainsi
 * que les badges sont distribués le jour J, un paquet par chef de délégation.
 * Une archive à plat obligerait à retrier trois cents fichiers à la main.
 *
 * Les badges non encore rendus sont **comptés et signalés**, pas ignorés en
 * silence : une archive de 180 fichiers là où on en attendait 200 doit se voir.
 */
export async function exporterZip(
  editionId: string,
  filtre: FiltreBadges,
  actorUserId: string | undefined,
): Promise<ArchiveBadges> {
  const participants = await prisma.participant.findMany({
    where: perimetreFiltre(editionId, filtre),
    orderBy: [{ delegation: { name: "asc" } }, { lastName: "asc" }],
    select: {
      publicId: true,
      firstName: true,
      lastName: true,
      delegation: { select: { name: true } },
      badges: {
        where: { revokedAt: null, pdfPath: { not: null } },
        orderBy: { version: "desc" },
        take: 1,
        select: { pdfPath: true, version: true },
      },
    },
  });

  const entrees: EntreeZip[] = [];
  let manquants = 0;

  for (const participant of participants) {
    const badge = participant.badges[0];
    if (!badge?.pdfPath) {
      manquants++;
      continue;
    }

    let contenu: Buffer;
    try {
      contenu = await fileStorage.get(badge.pdfPath);
    } catch {
      // Ligne en base sans fichier sur le disque : on le compte comme manquant
      // plutôt que d'interrompre l'export de deux cents autres badges.
      manquants++;
      continue;
    }

    const dossier = nomSur(participant.delegation?.name ?? "Sans delegation");
    const nom = nomSur(
      `${participant.lastName.toUpperCase()}-${participant.firstName}-${participant.publicId}`,
    );
    entrees.push({ nom: `${dossier}/${nom}.pdf`, contenu });
  }

  await audit.log({
    actorType: "USER",
    actorUserId,
    action: "badge.bulk_export",
    entity: "Edition",
    entityId: editionId,
    after: { inclus: entrees.length, manquants, filtre },
  });

  return {
    fichier: creerZip(entrees),
    nom: `badges-${new Date().toISOString().slice(0, 10)}.zip`,
    inclus: entrees.length,
    manquants,
  };
}

/**
 * Badges prêts pour la planche d'impression.
 *
 * Ne retient que ceux dont le **PNG** est rendu : la planche affiche l'image
 * déjà produite, de sorte que ce qui sort de l'imprimante soit exactement ce
 * qui a été vérifié à la génération, sans dépendre des polices installées sur
 * le poste de l'accueil. Les identifiants sont renvoyés plutôt que les
 * fichiers, chaque image étant chargée par sa propre route authentifiée.
 */
export async function badgesAImprimer(
  editionId: string,
  filtre: FiltreBadges,
  limite = 100,
): Promise<{ badgeId: string; nom: string; publicId: string; ancienGabarit: boolean }[]> {
  const participants = await prisma.participant.findMany({
    where: {
      ...perimetreFiltre(editionId, filtre),
      badges: { some: { revokedAt: null, pngPath: { not: null } } },
    },
    orderBy: [{ delegation: { name: "asc" } }, { lastName: "asc" }],
    take: limite,
    select: {
      publicId: true,
      firstName: true,
      lastName: true,
      badges: {
        where: { revokedAt: null, pngPath: { not: null } },
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true, pngPath: true },
      },
    },
  });

  return participants
    .filter((participant) => participant.badges[0])
    .map((participant) => ({
      badgeId: participant.badges[0]!.id,
      nom: `${participant.lastName.toUpperCase()} ${participant.firstName}`,
      publicId: participant.publicId,
      ancienGabarit: !auGabaritCourant(participant.badges[0]!.pngPath),
    }));
}
