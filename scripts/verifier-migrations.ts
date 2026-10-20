import { join } from "node:path";
import { GARDE_DEPUIS, verifierMigrations } from "../prisma/garde-migrations";

/**
 * Relit les migrations avant leur application (19 octobre 2026).
 *
 *     pnpm migrations:verifier
 *
 * Lancé par `scripts/deployer.sh` avant `prisma migrate deploy` : une migration
 * qui supprimerait ou réécrirait des données de production arrête le
 * déploiement **avant** de toucher à la base. Les règles, et la façon de
 * justifier une exception, sont dans `prisma/garde-migrations.ts`.
 */
const rapports = verifierMigrations(join(process.cwd(), "prisma", "migrations"));

if (rapports.length === 0) {
  console.log(
    `Migrations relues (depuis ${GARDE_DEPUIS}) : aucune ne supprime ni ne réécrit de données existantes.`,
  );
} else {
  console.error("Migrations refusées : elles toucheraient à des données existantes.\n");
  for (const { migration, infractions } of rapports) {
    console.error(`  ${migration}`);
    for (const { motif, instruction } of infractions) {
      console.error(`    - ${motif}\n      ${instruction}`);
    }
  }
  console.error(
    "\nRien n'a été appliqué. Réécrire la migration pour ne remplir que des champs vides, " +
      "ou justifier l'exception par un commentaire « -- garde-donnees: … » (prisma/garde-migrations.ts).",
  );
  process.exitCode = 1;
}
