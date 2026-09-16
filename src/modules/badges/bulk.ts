import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { creerZip, nomSur, type EntreeZip } from "@/lib/zip";
import { enqueueBadgeGeneration } from "@/modules/participants/service";

/**
 * Génération et export de badges en lot (brief §5.4).
 *
 * La génération passe par la **file de jobs** : rendre 500 badges prend environ
 * deux minutes (`pnpm bench:badges`), ce qu'aucune requête HTTP ne doit
 * attendre. L'écran met en file et rend la main ; le compteur se met à jour au
 * rythme du worker.
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

function where(editionId: string, filtre: FiltreBadges): Prisma.ParticipantWhereInput {
  const base: Prisma.ParticipantWhereInput = {
    editionId,
    deletedAt: null,
    status: STATUTS_BADGEABLES,
    ...(filtre.categoryId ? { categoryId: filtre.categoryId } : {}),
    ...(filtre.delegationId ? { delegationId: filtre.delegationId } : {}),
  };

  if (filtre.etat === "SANS") {
    // Aucun badge, ou aucun badge encore rendu : les deux cas se traitent de la
    // même façon, il faut lancer une génération.
    return { ...base, badges: { none: { revokedAt: null, generatedAt: { not: null } } } };
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
  impressions: number;
}

export async function lister(
  editionId: string,
  filtre: FiltreBadges,
  limite = 200,
): Promise<LigneBadge[]> {
  const participants = await prisma.participant.findMany({
    where: where(editionId, filtre),
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
        select: { id: true, version: true, generatedAt: true, revokedAt: true, printedCount: true },
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
      impressions: badge?.printedCount ?? 0,
    };
  });
}

export async function compter(editionId: string, filtre: FiltreBadges): Promise<number> {
  return prisma.participant.count({ where: where(editionId, filtre) });
}

/**
 * Met en file la génération pour tout le périmètre du filtre.
 *
 * Les participants qui ont déjà un badge valide sont **écartés** : régénérer
 * produirait le même fichier pour un coût réel, et le bouton sert à rattraper
 * ce qui manque, pas à tout refaire. La réédition d'un badge précis reste
 * accessible depuis la fiche.
 */
export async function genererEnLot(
  editionId: string,
  filtre: FiltreBadges,
  actorUserId: string | undefined,
): Promise<{ misEnFile: number }> {
  const participants = await prisma.participant.findMany({
    where: where(editionId, { ...filtre, etat: "SANS" }),
    select: { id: true },
  });

  for (const participant of participants) {
    await enqueueBadgeGeneration(participant.id);
  }

  await audit.log({
    actorType: "USER",
    actorUserId,
    action: "badge.bulk_generate",
    entity: "Edition",
    entityId: editionId,
    after: { misEnFile: participants.length, filtre },
  });

  return { misEnFile: participants.length };
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
    where: where(editionId, filtre),
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
): Promise<{ badgeId: string; nom: string; publicId: string }[]> {
  const participants = await prisma.participant.findMany({
    where: {
      ...where(editionId, filtre),
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
        select: { id: true },
      },
    },
  });

  return participants
    .filter((participant) => participant.badges[0])
    .map((participant) => ({
      badgeId: participant.badges[0]!.id,
      nom: `${participant.lastName.toUpperCase()} ${participant.firstName}`,
      publicId: participant.publicId,
    }));
}
