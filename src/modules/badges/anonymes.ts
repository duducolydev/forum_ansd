import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fileStorage } from "@/lib/storage";
import { creerZip, nomSur, type EntreeZip } from "@/lib/zip";
import type { Actor } from "@/modules/participants/service";
import { buildBadgeToken, hashBadgeToken } from "./token";

/**
 * Badges anonymes : le stock de secours du jour J (19 novembre 2026).
 *
 * ## Ce qu'ils servent
 *
 * Des cartes à remettre à qui se présente sans inscription — garde du corps
 * d'une délégation, chef de protocole, visiteur de passage, imprévu. Elles
 * portent un QR valide, passent les contrôles et laissent leur trace ; elles
 * n'ont simplement pas de porteur en base.
 *
 * ## Pourquoi pas de participant fictif
 *
 * Parce qu'une fiche de participant est attirée par tout le reste du système.
 * Elle entrerait dans les requêtes d'envoi, qui sélectionnent par statut sans
 * notion de « faux » : une lettre d'information partirait vers cinquante
 * adresses inventées, en rebonds et en quota consommé. Elle entrerait aussi
 * dans les vingt-huit agrégats qui comptent les inscrits — en oublier un
 * fausse un chiffre officiel.
 *
 * ## Numérotation
 *
 * Le numéro est **continu par catégorie** et ne se réutilise jamais, même
 * après révocation : c'est lui qu'on inscrit au registre de remise, en face
 * d'un nom et d'une heure. Deux cartes « PROTOCOLE n° 14 » rendraient ce
 * registre inexploitable.
 */

/** Préfixe de la référence imprimée, pour qu'elle se lise sans ambiguïté. */
const MARQUE = "ANON";

export interface StockAnonyme {
  categoryId: string;
  categorieLabel: string;
  couleur: string | null;
  /** Cartes émises et non révoquées. */
  total: number;
  /** Cartes dont le PDF est rendu, donc imprimables. */
  pretes: number;
  dernierNumero: number;
}

/** Référence imprimée, dérivée du code de l'édition et du numéro. */
export function referenceAnonyme(editionCode: string, numero: number): string {
  return `${editionCode}-${MARQUE}-${String(numero).padStart(3, "0")}`;
}

/**
 * Crée `nombre` cartes anonymes pour une catégorie, sans les rendre.
 *
 * Le rendu part en file comme pour les autres badges : cinquante rendus dans
 * la requête tiendraient la minute. La fonction rend les identifiants créés,
 * à charge de l'appelant de les mettre en file.
 */
export async function creerBadgesAnonymes(
  editionId: string,
  categoryId: string,
  nombre: number,
  actor: Actor,
): Promise<{ ids: string[]; references: string[] }> {
  if (!Number.isInteger(nombre) || nombre < 1) {
    throw new Error("Le nombre de badges anonymes doit être un entier positif.");
  }
  if (nombre > 200) {
    throw new Error("Pas plus de 200 badges anonymes à la fois.");
  }

  const [edition, categorie] = await Promise.all([
    prisma.edition.findUniqueOrThrow({ where: { id: editionId }, select: { code: true } }),
    prisma.participantCategory.findUniqueOrThrow({
      where: { id: categoryId },
      select: { id: true, editionId: true, labelFr: true },
    }),
  ]);
  if (categorie.editionId !== editionId) {
    throw new Error("Cette catégorie n'appartient pas à l'édition active.");
  }

  /*
   * Le dernier numéro est lu **toutes cartes confondues**, révoquées
   * comprises : un numéro retiré de la circulation ne revient pas, sous peine
   * de rendre le registre de remise ambigu.
   */
  const dernier = await prisma.badge.aggregate({
    where: { anonymousCategoryId: categoryId },
    _max: { anonymousSeq: true },
  });
  const depart = (dernier._max.anonymousSeq ?? 0) + 1;

  const lignes = Array.from({ length: nombre }, (_, index) => {
    const numero = depart + index;
    const reference = referenceAnonyme(edition.code, numero);
    return {
      version: 1,
      qrToken: hashBadgeToken(buildBadgeToken(reference, 1)),
      anonymousRef: reference,
      anonymousSeq: numero,
      anonymousCategoryId: categoryId,
    };
  });

  /*
   * Une seule écriture pour tout le lot, et une relecture pour les
   * identifiants — `createMany` ne les rend pas. Deux allers-retours au lieu
   * de deux cents : la leçon des mises en file, appliquée ici aussi.
   *
   * Deux opérateurs cliquant en même temps liraient le même dernier numéro.
   * Le second échoue alors sur l'unicité d'`anonymousRef`, et rien n'est créé
   * — un refus net, préférable à deux cartes « PROTOCOLE n° 14 » en
   * circulation, que rien ne rattraperait une fois imprimées.
   */
  await prisma.badge.createMany({ data: lignes });

  const references = lignes.map((ligne) => ligne.anonymousRef);
  const crees = await prisma.badge.findMany({
    where: { anonymousRef: { in: references } },
    orderBy: { anonymousSeq: "asc" },
    select: { id: true },
  });
  const ids = crees.map((carte) => carte.id);

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "badge.anonymous_created",
    entity: "Edition",
    entityId: editionId,
    after: {
      categorie: categorie.labelFr,
      nombre,
      du: references[0],
      au: references[references.length - 1],
    },
  });

  return { ids, references };
}

/**
 * Archive ZIP du stock anonyme d'une catégorie.
 *
 * Séparée de l'export ordinaire, qui part des participants : ces cartes n'en
 * ont pas, et les faire entrer dans cette requête aurait demandé d'y tordre
 * chaque jointure. Les fichiers sont nommés par leur numéro, dans l'ordre, de
 * sorte qu'un lot sorte de l'imprimante déjà trié.
 */
export async function exporterStockAnonyme(
  editionId: string,
  categoryId: string,
): Promise<{ fichier: Buffer; nom: string; inclus: number; manquants: number }> {
  const categorie = await prisma.participantCategory.findUniqueOrThrow({
    where: { id: categoryId },
    select: { editionId: true, code: true },
  });
  if (categorie.editionId !== editionId) {
    throw new Error("Cette catégorie n'appartient pas à l'édition active.");
  }

  const cartes = await prisma.badge.findMany({
    where: { anonymousCategoryId: categoryId, revokedAt: null, pdfPath: { not: null } },
    orderBy: { anonymousSeq: "asc" },
    select: { pdfPath: true, anonymousRef: true, anonymousSeq: true },
  });

  const entrees: EntreeZip[] = [];
  let manquants = 0;

  for (const carte of cartes) {
    if (!carte.pdfPath) {
      manquants += 1;
      continue;
    }
    try {
      entrees.push({
        nom: nomSur(
          `${String(carte.anonymousSeq ?? 0).padStart(3, "0")}-${carte.anonymousRef ?? "sans-ref"}`,
        ).concat(".pdf"),
        contenu: await fileStorage.get(carte.pdfPath),
      });
    } catch {
      // Ligne en base sans fichier : comptée manquante, sans interrompre le lot.
      manquants += 1;
    }
  }

  const attendues = await prisma.badge.count({
    where: { anonymousCategoryId: categoryId, revokedAt: null },
  });

  return {
    fichier: creerZip(entrees),
    nom: `badges-anonymes-${nomSur(categorie.code)}-${new Date().toISOString().slice(0, 10)}.zip`,
    inclus: entrees.length,
    manquants: manquants + Math.max(0, attendues - cartes.length),
  };
}

/** Ce que chaque catégorie compte de cartes anonymes, pour l'écran Badges. */
export async function inventaireAnonymes(editionId: string): Promise<StockAnonyme[]> {
  const categories = await prisma.participantCategory.findMany({
    where: { editionId, badgesAnonymes: { some: {} } },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      labelFr: true,
      color: true,
      badgesAnonymes: {
        select: { revokedAt: true, generatedAt: true, anonymousSeq: true },
      },
    },
  });

  return categories.map((categorie) => {
    const vivantes = categorie.badgesAnonymes.filter((badge) => badge.revokedAt === null);
    return {
      categoryId: categorie.id,
      categorieLabel: categorie.labelFr,
      couleur: categorie.color,
      total: vivantes.length,
      pretes: vivantes.filter((badge) => badge.generatedAt !== null).length,
      dernierNumero: categorie.badgesAnonymes.reduce(
        (plus, badge) => Math.max(plus, badge.anonymousSeq ?? 0),
        0,
      ),
    };
  });
}
