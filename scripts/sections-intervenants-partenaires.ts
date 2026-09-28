import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";

/**
 * Ajoute les sections « Intervenants » et « Partenaires » à la page d'accueil
 * d'une édition existante (demande du 28 septembre 2026).
 *
 *   pnpm section:intervenants-partenaires          # applique
 *   pnpm section:intervenants-partenaires --essai  # montre ce qui serait fait
 *
 * Même raison d'être que `section-a-propos.ts` : la composition du code
 * (`src/modules/sections/defaut.ts`) ne sert qu'aux installations où aucune
 * section n'a encore été enregistrée. Ailleurs, c'est la base qui pilote la
 * page, et seule une écriture en base fait apparaître les deux sections.
 *
 * **Idempotent** : une section de ce type déjà présente sur l'accueil, visible
 * ou masquée, n'est ni dupliquée ni modifiée — si le comité l'a masquée, c'est
 * un choix, pas un oubli à corriger.
 */

const PAGE = "accueil";

interface Modele {
  type: "intervenants" | "sponsors";
  libelle: string;
  variant: string;
  settings: Prisma.InputJsonObject;
  contentFr: Record<string, string>;
  contentEn: Record<string, string>;
}

const MODELES: Modele[] = [
  {
    type: "intervenants",
    libelle: "Intervenants",
    variant: "grille",
    settings: { nombre: 8 },
    contentFr: { titre: "Intervenants" },
    contentEn: { titre: "Speakers" },
  },
  {
    type: "sponsors",
    libelle: "Partenaires",
    variant: "carrousel",
    settings: {},
    contentFr: { titre: "Partenaires" },
    contentEn: { titre: "Partners" },
  },
];

/** Premier rang libre à partir de `voulu` : on décale plutôt que d'écraser l'ordre choisi. */
function rangLibre(pris: Set<number>, voulu: number): number {
  let rang = voulu;
  while (pris.has(rang)) rang += 1;
  return rang;
}

async function main(): Promise<void> {
  const essai = process.argv.includes("--essai");

  const edition = await prisma.edition.findFirst({ where: { isActive: true } });
  if (!edition) throw new Error("Aucune édition active.");

  const sections = await prisma.pageSection.findMany({
    where: { editionId: edition.id, page: PAGE },
    orderBy: { sortOrder: "asc" },
  });

  if (sections.length === 0) {
    console.log(
      "Aucune section en base : la page suit encore la composition du code, qui contient déjà les deux sections. Rien à faire.",
    );
    return;
  }

  const pris = new Set(sections.map((section) => section.sortOrder));
  const dernier = sections[sections.length - 1]!.sortOrder;
  const actualites = sections.find((section) => section.type === "actualites");

  for (const modele of MODELES) {
    const existante = sections.find((section) => section.type === modele.type);
    if (existante) {
      console.log(
        `Section « ${modele.libelle} » déjà présente (${existante.id}, ${
          existante.isVisible ? "visible" : "masquée"
        }). Rien à faire.`,
      );
      continue;
    }

    /*
     * Intervenants juste avant les actualités, partenaires en fin de page —
     * l'ordre de la composition du code. Sans section d'actualités, les deux
     * vont en fin de page. Le comité réordonne ensuite en BackOffice.
     */
    const voulu =
      modele.type === "intervenants" && actualites
        ? Math.max(actualites.sortOrder - 5, 0)
        : dernier + 10;
    const rang = rangLibre(pris, voulu);
    pris.add(rang);

    const donnees = {
      editionId: edition.id,
      page: PAGE,
      type: modele.type,
      variant: modele.variant,
      sortOrder: rang,
      isVisible: true,
      settings: modele.settings,
      contentFr: modele.contentFr,
      contentEn: modele.contentEn,
    };

    if (essai) {
      console.log(`Essai — la section « ${modele.libelle} » serait créée au rang ${rang}.`);
      continue;
    }

    const creee = await prisma.pageSection.create({ data: donnees });
    console.log(`Section « ${modele.libelle} » créée (${creee.id}), rang ${rang}.`);
  }

  if (!essai) {
    console.log("Elles se modifient en BackOffice : Paramètres → Sections de l'accueil.");
  }
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
