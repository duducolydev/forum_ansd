import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { creerZip, nomSur, type EntreeZip } from "@/lib/zip";
import { GABARIT_BADGE, auGabaritCourant } from "./format";
import { bornesDuJour, type FiltreBadges } from "./filtre";

/**
 * Périmètre, liste et export de badges en lot (brief §5.4).
 *
 * Ce fichier décrit **ce que le filtre de l'écran désigne** — les participants
 * visés, leur état, ce qu'on en montre et ce qu'on en exporte. Les gestes qui
 * agissent sur ce périmètre (générer, refaire, révoquer) vivent dans
 * `lot.ts`, qui réutilise `perimetreFiltre` pour travailler exactement sur les
 * mêmes lignes que la liste.
 */

export type { FiltreBadges } from "./filtre";

/**
 * Condition d'export, à combiner au badge que la branche d'`etat` désigne.
 *
 * Elle porte sur **le badge**, pas sur le participant : un badge refait en
 * version suivante est un autre badge, qui n'est pas parti à l'impression même
 * si son prédécesseur l'était. C'est précisément le cas qu'on ne veut pas
 * manquer le jour J.
 *
 * Le jour d'export porte sur `exportedAt`, c'est-à-dire le **dernier** envoi :
 * un badge parti le 19 puis renvoyé le 21 appartient au lot du 21.
 */
function conditionExport(filtre: FiltreBadges): Prisma.BadgeWhereInput {
  if (filtre.exporteLe) return { exportedAt: bornesDuJour(filtre.exporteLe) };
  if (filtre.export === "JAMAIS") return { exportedAt: null };
  if (filtre.export === "DEJA") return { exportedAt: { not: null } };
  return {};
}

/** Le filtre ne retient que des badges déjà partis à l'impression. */
function exigeUnExport(filtre: FiltreBadges): boolean {
  return filtre.export === "DEJA" || Boolean(filtre.exporteLe);
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
    const jamaisRendu = {
      none: { OR: [{ revokedAt: { not: null } }, { generatedAt: { not: null } }] },
    };
    /*
     * Croisé avec « déjà exporté », ce filtre ne désigne personne : on ne peut
     * pas avoir envoyé à l'imprimeur un badge qui n'existe pas. Les deux
     * clauses coexistent dans le même filtre de relation — `none` et `some` se
     * cumulent — et se contredisent, ce qui est exactement voulu. Omettre le
     * croisement laisserait le filtre « sans badge » répondre « 893 » à une
     * question dont la réponse est zéro.
     */
    return {
      ...base,
      badges: exigeUnExport(filtre)
        ? { ...jamaisRendu, some: conditionExport(filtre) }
        : jamaisRendu,
    };
  }
  const exporte = conditionExport(filtre);

  if (filtre.etat === "AVEC") {
    return {
      ...base,
      badges: { some: { revokedAt: null, generatedAt: { not: null }, ...exporte } },
    };
  }
  if (filtre.etat === "REVOQUE") {
    return {
      ...base,
      badges: { some: { revokedAt: { not: null }, ...exporte }, none: { revokedAt: null } },
    };
  }

  /*
   * « Tous » avec une condition d'export se restreint aux porteurs d'un badge
   * valide, et c'est la seule lecture utile : un participant sans badge n'a
   * rien à envoyer à l'imprimeur, et le faire figurer parmi « jamais exportés »
   * gonflerait le compte de lignes que l'export compterait ensuite comme
   * manquantes.
   */
  if (filtre.export || filtre.exporteLe) {
    return {
      ...base,
      badges: { some: { revokedAt: null, generatedAt: { not: null }, ...exporte } },
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
  /** Badge déjà emporté par un export ZIP — donc déjà chez l'imprimeur. */
  exporte: boolean;
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
          exportedAt: true,
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
      exporte: badge?.exportedAt != null,
    };
  });
}

export async function compter(editionId: string, filtre: FiltreBadges): Promise<number> {
  return prisma.participant.count({ where: perimetreFiltre(editionId, filtre) });
}

/**
 * Déclare le périmètre courant comme **déjà parti à l'impression**, sans
 * produire d'archive.
 *
 * Les exports antérieurs au 19 novembre 2026 n'ont rien laissé d'exploitable :
 * le journal d'audit en retient le nombre, jamais la liste. Les 394 badges
 * confiés à l'imprimeur ce jour-là sont donc invisibles au nouveau filtre, et
 * repartiraient dans l'envoi suivant.
 *
 * Plutôt que de deviner — « tout ce qui existait avant telle heure » serait une
 * affirmation que personne ne peut vérifier —, l'opérateur **reproduit le
 * filtre** de l'envoi passé et le déclare. Il sait ce qu'il a imprimé ; la base
 * ne le sait pas.
 *
 * Ne touche que les badges valides et rendus : déclarer exporté un badge qui
 * n'a pas de PDF le ferait disparaître de la liste « à envoyer » sans que rien
 * ne soit jamais parti.
 */
export async function marquerExportes(
  editionId: string,
  filtre: FiltreBadges,
  actorUserId: string | undefined,
): Promise<number> {
  const participants = await prisma.participant.findMany({
    where: perimetreFiltre(editionId, filtre),
    select: {
      badges: {
        where: { revokedAt: null, generatedAt: { not: null }, pdfPath: { not: null } },
        orderBy: { version: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });

  const ids = participants
    .map((participant) => participant.badges[0]?.id)
    .filter((id): id is string => id !== undefined);
  if (ids.length === 0) return 0;

  const { count } = await prisma.badge.updateMany({
    where: { id: { in: ids } },
    data: { exportedAt: new Date(), exportCount: { increment: 1 } },
  });

  await audit.log({
    actorType: "USER",
    actorUserId,
    action: "badge.marked_exported",
    entity: "Edition",
    entityId: editionId,
    after: { marques: count, filtre },
  });

  return count;
}

/**
 * Badges valides rendus avec un gabarit antérieur — la carte CR80, le premier
 * 100 × 150 mm —, repérés au nom de leur fichier (`format.ts`).
 */
export function aRefaireAuGabarit(
  editionId: string,
  filtre: FiltreBadges,
): Prisma.ParticipantWhereInput {
  // `AND` et non un étalement : la clé `badges` du périmètre porte le filtre
  // d'export, qu'un second `badges` écraserait.
  return {
    AND: [
      perimetreFiltre(editionId, { ...filtre, etat: undefined }),
      {
        badges: {
          some: {
            revokedAt: null,
            generatedAt: { not: null },
            NOT: { pngPath: { contains: `-${GABARIT_BADGE}.` } },
          },
        },
      },
    ],
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
 * Comment les PDF sont rangés dans l'archive.
 *
 * `delegation` sert la distribution du jour J : un dossier par chef de
 * délégation. `plat` sert tout le reste — imprimer d'une traite, déposer le
 * lot chez un prestataire, archiver — où la hiérarchie oblige à rouvrir
 * quarante dossiers pour atteindre trois cents fichiers.
 */
export type RangementArchive = "delegation" | "plat";

/**
 * Archive ZIP des PDF du périmètre filtré (brief §5.4).
 *
 * Par défaut, un dossier par délégation plus un dossier « Sans délégation » :
 * c'est ainsi que les badges sont distribués le jour J, un paquet par chef de
 * délégation, et une archive à plat obligerait à retrier trois cents fichiers
 * à la main.
 *
 * Ce rangement dessert en revanche l'autre usage, apparu à l'approche du
 * Forum (18 novembre 2026) : prendre **tous** les badges d'un coup pour les
 * imprimer ou les confier à un prestataire. `rangement: "plat"` met alors les
 * PDF côte à côte, dans une archive qu'on sélectionne d'un Ctrl+A. Le nom de
 * fichier porte toujours le nom du participant, précédé de sa délégation :
 * l'information du dossier n'est pas perdue, elle devient triable.
 *
 * Les badges non encore rendus sont **comptés et signalés**, pas ignorés en
 * silence : une archive de 180 fichiers là où on en attendait 200 doit se voir.
 */
export async function exporterZip(
  editionId: string,
  filtre: FiltreBadges,
  actorUserId: string | undefined,
  rangement: RangementArchive = "delegation",
  marquer = true,
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
        select: { id: true, pdfPath: true, version: true },
      },
    },
  });

  const entrees: EntreeZip[] = [];
  const emportes: string[] = [];
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
    entrees.push({
      // À plat, le séparateur est entouré d'espaces : les deux moitiés portent
      // déjà des tirets (« NDIAYE-Awa-FID26-2 »), et un tiret de plus collé
      // aux autres rendrait la frontière illisible.
      nom: rangement === "plat" ? `${dossier} - ${nom}.pdf` : `${dossier}/${nom}.pdf`,
      contenu,
    });
    emportes.push(badge.id);
  }

  /*
   * Le marquage suit l'archive, et seulement elle : un badge compté comme
   * manquant n'y figure pas, donc n'est pas marqué. `marquer: false` existe
   * pour les exports de vérification — sans quoi une simple curiosité
   * retirerait des badges de la liste « à envoyer », et personne ne s'en
   * apercevrait avant la table d'accueil.
   */
  if (marquer && emportes.length > 0) {
    await prisma.badge.updateMany({
      where: { id: { in: emportes } },
      data: { exportedAt: new Date(), exportCount: { increment: 1 } },
    });
  }

  await audit.log({
    actorType: "USER",
    actorUserId,
    action: "badge.bulk_export",
    entity: "Edition",
    entityId: editionId,
    after: { inclus: entrees.length, manquants, filtre, rangement, marquer },
  });

  return {
    fichier: creerZip(entrees),
    nom:
      rangement === "plat"
        ? `badges-tous-${new Date().toISOString().slice(0, 10)}.zip`
        : `badges-${new Date().toISOString().slice(0, 10)}.zip`,
    inclus: entrees.length,
    manquants,
  };
}

/**
 * Participants de la planche : le périmètre du filtre, restreint aux porteurs
 * d'une image rendue.
 *
 * Les deux conditions se cumulent par `AND`. Jusqu'au 22 novembre 2026, la
 * seconde était étalée par-dessus le périmètre et **écrasait** sa clé
 * `badges` : les filtres d'état et d'export n'avaient aucun effet sur la
 * planche, qui sortait tout le périmètre.
 */
function perimetrePlanche(editionId: string, filtre: FiltreBadges): Prisma.ParticipantWhereInput {
  return {
    AND: [
      perimetreFiltre(editionId, filtre),
      { badges: { some: { revokedAt: null, pngPath: { not: null } } } },
    ],
  };
}

/** Nombre total de badges de la planche, tous lots confondus. */
export async function compterAImprimer(editionId: string, filtre: FiltreBadges): Promise<number> {
  return prisma.participant.count({ where: perimetrePlanche(editionId, filtre) });
}

/**
 * Jours où des badges sont partis à l'impression, avec leur nombre, du plus
 * récent au plus ancien — les raccourcis de la planche.
 *
 * Seuls la catégorie et la délégation du filtre s'appliquent : l'état et
 * l'export sont précisément ce que ces raccourcis viennent remplacer. Un badge
 * révoqué depuis n'y figure plus — il n'est plus imprimable.
 */
export async function joursExport(
  editionId: string,
  filtre: Pick<FiltreBadges, "categoryId" | "delegationId">,
): Promise<{ jour: string; badges: number }[]> {
  const envois = await prisma.badge.groupBy({
    by: ["exportedAt"],
    where: {
      exportedAt: { not: null },
      revokedAt: null,
      pngPath: { not: null },
      participant: {
        is: perimetreFiltre(editionId, {
          categoryId: filtre.categoryId,
          delegationId: filtre.delegationId,
        }),
      },
    },
    _count: { _all: true },
  });

  // Un export marque tout son lot au même instant : on regroupe ces instants par jour.
  const parJour = new Map<string, number>();
  for (const envoi of envois) {
    if (!envoi.exportedAt) continue;
    const jour = envoi.exportedAt.toISOString().slice(0, 10);
    parJour.set(jour, (parJour.get(jour) ?? 0) + envoi._count._all);
  }
  return [...parJour.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([jour, badges]) => ({ jour, badges }));
}

/**
 * Badges prêts pour la planche d'impression, un lot à la fois.
 *
 * Ne retient que ceux dont le **PNG** est rendu : la planche affiche l'image
 * déjà produite, de sorte que ce qui sort de l'imprimante soit exactement ce
 * qui a été vérifié à la génération, sans dépendre des polices installées sur
 * le poste de l'accueil. Les identifiants sont renvoyés plutôt que les
 * fichiers, chaque image étant chargée par sa propre route authentifiée.
 *
 * `decalage` découpe un périmètre trop grand pour une seule planche. L'ordre
 * finit par l'identifiant : deux homonymes d'une même délégation garderaient
 * sinon un rang instable, et l'un pourrait passer d'un lot à l'autre — imprimé
 * deux fois, ou jamais.
 */
export async function badgesAImprimer(
  editionId: string,
  filtre: FiltreBadges,
  limite = 100,
  decalage = 0,
): Promise<{ badgeId: string; nom: string; publicId: string; ancienGabarit: boolean }[]> {
  const participants = await prisma.participant.findMany({
    where: perimetrePlanche(editionId, filtre),
    orderBy: [
      { delegation: { name: "asc" } },
      { lastName: "asc" },
      { firstName: "asc" },
      { id: "asc" },
    ],
    skip: decalage,
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
