import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import { detecterImageDeposee } from "../src/lib/image-deposee";

/**
 * Attache une illustration de `public/images` à une section de l'accueil.
 *
 *   pnpm illustrer:accueil          # applique
 *   pnpm illustrer:accueil --essai  # montre ce qui serait fait
 *
 * ## Pourquoi passer par le stockage plutôt que référencer `/images/…`
 *
 * Les fichiers de `public/` sont servis tels quels par le serveur et ne sont
 * modifiables que par un redéploiement. En les important dans le stockage, ils
 * deviennent des illustrations **de section** : remplaçables depuis le
 * BackOffice, supprimables, versionnées avec le reste du contenu. Le but de ce
 * script est d'amorcer, pas de figer.
 *
 * Il est idempotent : une section qui porte déjà une illustration est laissée
 * telle quelle, pour ne pas écraser un choix fait à la main.
 */

/** Sections visées, désignées par ce qui les identifie de façon stable. */
const CIBLES: {
  repere: { ancre?: string; type?: string };
  fichier: string;
  description: string;
}[] = [
  {
    repere: { type: "hero" },
    fichier: "26371389ebabd0424e8a482b8e2f4b4f.jpg",
    description: "Tableau de bord de données, en fond décoratif du bandeau",
  },
  {
    repere: { ancre: "a-propos" },
    fichier: "d1fafc968c8f0edf430175b2cb93eeef.jpg",
    description: "Histogramme isométrique, à côté du texte de présentation",
  },
];

async function main(): Promise<void> {
  const essai = process.argv.includes("--essai");

  const edition = await prisma.edition.findFirst({ where: { isActive: true } });
  if (!edition) throw new Error("Aucune édition active.");

  const sections = await prisma.pageSection.findMany({
    where: { editionId: edition.id, page: "accueil" },
    orderBy: { sortOrder: "asc" },
  });
  if (sections.length === 0) {
    console.log("Aucune section en base : rien à illustrer. Voir `pnpm section:a-propos`.");
    return;
  }

  for (const cible of CIBLES) {
    const section = sections.find((candidate) => {
      const reglages = candidate.settings as Record<string, unknown> | null;
      if (cible.repere.ancre) return reglages?.ancre === cible.repere.ancre;
      return candidate.type === cible.repere.type;
    });

    if (!section) {
      console.log(`· section introuvable pour ${JSON.stringify(cible.repere)} — ignorée.`);
      continue;
    }

    const reglages = (section.settings as Record<string, unknown> | null) ?? {};
    if (typeof reglages.image === "string" && reglages.image) {
      console.log(`· ${section.type} (${section.id}) porte déjà une illustration — laissée.`);
      continue;
    }

    const octets = readFileSync(join(process.cwd(), "public/images", cible.fichier));
    const { type, refus } = detecterImageDeposee(octets);
    if (!type) throw new Error(`${cible.fichier} : ${refus}`);

    if (essai) {
      console.log(
        `· ${section.type} (${section.id}) recevrait ${cible.fichier} — ${cible.description}`,
      );
      continue;
    }

    const chemin = `sections/${section.id}-${randomBytes(6).toString("hex")}.${type.extension}`;
    await fileStorage.put(chemin, octets, type.type);

    await prisma.pageSection.update({
      where: { id: section.id },
      data: { settings: { ...reglages, image: chemin } },
    });

    console.log(`· ${section.type} (${section.id}) illustrée — ${cible.description}`);
  }

  if (!essai) {
    console.log(
      "\\nLes illustrations se remplacent en BackOffice : Paramètres → Sections de l'accueil.",
    );
  }
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
