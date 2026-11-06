import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { estPaysDeReference, trouverPays } from "@/lib/pays";

/**
 * Harmonisation des pays déjà en base (6 novembre 2026).
 *
 * Le pays était un texte libre : « Sénégal », « Senegal », « SN », « Sn »…
 * Les formulaires proposent désormais une liste (`lib/pays.ts`) ; restent les
 * valeurs saisies avant. Elles sont ramenées à la liste **depuis le
 * BackOffice**, et non par une migration : les données de production ne
 * changent que par une action de l'administration, qui voit chaque
 * remplacement avant de l'appliquer.
 *
 * ## À l'octet près
 *
 * La base compare sans casse ni accents (`utf8mb4_unicode_ci`) : regroupées
 * ainsi, « Sénégal », « SENEGAL » et « senegal » ne feraient qu'une ligne, et
 * les variantes à corriger resteraient invisibles. Inventaire et
 * remplacements comparent donc en `utf8mb4_bin`, valeur exacte contre valeur
 * exacte.
 */

/** Tables qui portent un pays, et ce qu'elles représentent pour le comité. */
const TABLES = {
  participants: "Participant",
  intervenants: "Speaker",
  invitations: "Invitation",
  delegations: "Delegation",
} as const;

export type TablePays = keyof typeof TABLES;

export interface ValeurPays {
  /** Valeur exacte en base. */
  valeur: string;
  total: number;
  parTable: Record<TablePays, number>;
  /** Nom de référence reconnu, ou `null` s'il faut choisir à la main. */
  proposition: string | null;
}

function tableSql(table: TablePays): Prisma.Sql {
  // Nom de table pris dans la liste fixe ci-dessus, jamais dans la requête.
  return Prisma.raw(`\`${TABLES[table]}\``);
}

/** Valeurs de pays qui ne sont pas encore un nom de référence, les plus fréquentes d'abord. */
export async function inventairePays(): Promise<{
  aHarmoniser: ValeurPays[];
  conformes: number;
}> {
  const parValeur = new Map<string, ValeurPays>();
  let conformes = 0;

  for (const table of Object.keys(TABLES) as TablePays[]) {
    const lignes = await prisma.$queryRaw<{ valeur: string; total: bigint | number }[]>`
      SELECT country COLLATE utf8mb4_bin AS valeur, COUNT(*) AS total
      FROM ${tableSql(table)}
      WHERE country IS NOT NULL AND country <> ''
      GROUP BY country COLLATE utf8mb4_bin`;

    for (const { valeur, total } of lignes) {
      const nombre = Number(total);
      if (estPaysDeReference(valeur)) {
        conformes += nombre;
        continue;
      }
      const entree = parValeur.get(valeur) ?? {
        valeur,
        total: 0,
        parTable: { participants: 0, intervenants: 0, invitations: 0, delegations: 0 },
        proposition: trouverPays(valeur)?.fr ?? null,
      };
      entree.total += nombre;
      entree.parTable[table] += nombre;
      parValeur.set(valeur, entree);
    }
  }

  const aHarmoniser = [...parValeur.values()].sort(
    (a, b) => b.total - a.total || a.valeur.localeCompare(b.valeur, "fr"),
  );
  return { aHarmoniser, conformes };
}

export interface Remplacement {
  de: string;
  vers: string;
}

export class HarmonisationError extends Error {}

/**
 * Remplace chaque valeur `de` par le nom de référence `vers`, dans les quatre
 * tables, en une transaction. Une cible hors de la liste est refusée :
 * harmoniser vers une valeur inconnue recréerait le désordre qu'on corrige.
 */
export async function harmoniserPays(
  remplacements: Remplacement[],
  acteur: { userId: string },
): Promise<{ valeurs: number; fiches: number }> {
  for (const { vers } of remplacements) {
    if (!estPaysDeReference(vers)) {
      throw new HarmonisationError(`« ${vers} » n'est pas un pays de la liste.`);
    }
  }
  const utiles = remplacements.filter(({ de, vers }) => de && de !== vers);
  if (utiles.length === 0) return { valeurs: 0, fiches: 0 };

  const detail: { de: string; vers: string; fiches: number }[] = [];
  await prisma.$transaction(async (tx) => {
    for (const { de, vers } of utiles) {
      let fiches = 0;
      for (const table of Object.keys(TABLES) as TablePays[]) {
        fiches += await tx.$executeRaw`
          UPDATE ${tableSql(table)} SET country = ${vers}
          WHERE country COLLATE utf8mb4_bin = ${de}`;
      }
      detail.push({ de, vers, fiches });
    }
  });

  const fiches = detail.reduce((somme, ligne) => somme + ligne.fiches, 0);
  await audit.log({
    actorType: "USER",
    actorUserId: acteur.userId,
    action: "settings.pays_harmonises",
    entity: "Pays",
    entityId: "harmonisation",
    after: { remplacements: detail, fiches },
  });

  return { valeurs: utiles.length, fiches };
}
