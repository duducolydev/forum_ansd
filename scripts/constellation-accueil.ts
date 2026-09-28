import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { PILIERS } from "../src/modules/sections/defaut";

/**
 * Passe l'accueil d'une édition existante au système « Constellation »
 * (docs/BRIEF-integration-animations.md).
 *
 *   pnpm section:constellation          # applique
 *   pnpm section:constellation --essai  # montre ce qui serait fait
 *
 * Même raison d'être que `section-a-propos.ts` : la composition du code ne
 * sert qu'aux installations où aucune section n'a encore été enregistrée ;
 * ailleurs, c'est la base qui pilote l'accueil.
 *
 * Trois changements, chacun **idempotent** et sans écraser un choix du
 * comité :
 *
 * 1. La section « À propos » (ancre `a-propos`) s'allume mot à mot au
 *    défilement et reçoit l'étiquette « Le Forum » — sauf si l'un ou l'autre a
 *    déjà été réglé.
 * 2. Une section « Piliers » est ajoutée juste après elle, s'il n'y en a
 *    aucune.
 * 3. Les actualités passent en frise, si elles sont encore dans la variante
 *    par défaut (« En cartes »). Une liste choisie exprès reste une liste.
 */

const PAGE = "accueil";

function champs(section: { contentFr: unknown; contentEn: unknown; settings: unknown }) {
  return {
    fr: { ...((section.contentFr as Record<string, string> | null) ?? {}) },
    en: { ...((section.contentEn as Record<string, string> | null) ?? {}) },
    reglages: { ...((section.settings as Record<string, unknown> | null) ?? {}) },
  };
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
      "Aucune section en base : l'accueil suit la composition du code, déjà à jour. Rien à faire.",
    );
    return;
  }

  const journal: string[] = [];
  const ecritures: (() => Promise<unknown>)[] = [];

  // 1. « À propos » révélé mot à mot.
  const aPropos = sections.find(
    (section) => (section.settings as Record<string, unknown> | null)?.ancre === "a-propos",
  );
  if (!aPropos) {
    journal.push("Section « À propos » introuvable (ancre a-propos) : étape ignorée.");
  } else {
    const { fr, en, reglages } = champs(aPropos);
    const aChanger = reglages.defilement === undefined || !fr.etiquette;
    if (aChanger) {
      if (reglages.defilement === undefined) reglages.defilement = true;
      if (!fr.etiquette) fr.etiquette = "Le Forum";
      if (!en.etiquette) en.etiquette = "The Forum";
      journal.push("« À propos » : texte révélé au défilement, étiquette « Le Forum ».");
      ecritures.push(() =>
        prisma.pageSection.update({
          where: { id: aPropos.id },
          data: {
            settings: reglages as Prisma.InputJsonObject,
            contentFr: fr,
            contentEn: en,
          },
        }),
      );
    } else {
      journal.push("« À propos » : déjà réglé. Rien à faire.");
    }
  }

  // 2. Piliers, juste après « À propos ».
  if (sections.some((section) => section.type === "piliers")) {
    journal.push("Piliers : déjà présents. Rien à faire.");
  } else {
    const pris = new Set(sections.map((section) => section.sortOrder));
    let rang = (aPropos?.sortOrder ?? 15) + 1;
    while (pris.has(rang)) rang += 1;
    const fr = Object.fromEntries(Object.entries(PILIERS).map(([cle, v]) => [cle, v.fr ?? ""]));
    const en = Object.fromEntries(Object.entries(PILIERS).map(([cle, v]) => [cle, v.en ?? ""]));
    journal.push(`Piliers : section ajoutée au rang ${rang}.`);
    ecritures.push(() =>
      prisma.pageSection.create({
        data: {
          editionId: edition.id,
          page: PAGE,
          type: "piliers",
          variant: aPropos?.variant === "sombre" ? "sombre" : (aPropos?.variant ?? "adouci"),
          sortOrder: rang,
          isVisible: true,
          settings: {},
          contentFr: fr,
          contentEn: en,
        },
      }),
    );
  }

  // 3. Actualités en frise.
  for (const section of sections.filter((s) => s.type === "actualites")) {
    if (section.variant === "cartes") {
      journal.push(`Actualités (${section.id}) : passage en frise.`);
      ecritures.push(() =>
        prisma.pageSection.update({ where: { id: section.id }, data: { variant: "frise" } }),
      );
    } else {
      journal.push(`Actualités (${section.id}) : variante « ${section.variant} » conservée.`);
    }
  }

  for (const ligne of journal) console.log(`${essai ? "Essai — " : ""}${ligne}`);
  if (essai) return;
  for (const ecrire of ecritures) await ecrire();
  console.log("Terminé. Tout se modifie en BackOffice : Paramètres → Sections de l'accueil.");
}

main()
  .catch((erreur) => {
    console.error(erreur instanceof Error ? erreur.message : erreur);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
