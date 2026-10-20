import "dotenv/config";
import { defineConfig, env } from "@prisma/config";
import { estProduction } from "./src/lib/environnement";

/*
 * Commandes Prisma refusées en production (19 octobre 2026).
 *
 * - `migrate reset` supprime toutes les tables et les recrée vides ;
 * - `migrate dev` propose ce même reset dès qu'il voit un écart entre
 *   l'historique des migrations et la base, puis rejoue le seed ;
 * - `db push` aligne la base sur le schéma sans migration, en supprimant au
 *   besoin les colonnes et les tables qui n'y figurent plus.
 *
 * Sur le serveur, seule `migrate deploy` touche au schéma : elle n'applique
 * que les migrations versionnées, relues par `prisma/garde-migrations.ts`.
 *
 * Le refus se fait ici parce que ce fichier est chargé par **chaque** commande
 * Prisma, dans le processus même de la ligne de commande : c'est le seul point
 * de passage commun, quelle que soit la façon dont la commande est lancée
 * (`pnpm prisma …`, `pnpm exec prisma …`, `pnpm prisma:migrate`).
 */
const COMMANDES_REFUSEES = [
  ["migrate", "reset"],
  ["migrate", "dev"],
  ["db", "push"],
] as const;

function commandeRefusee(argv: string[]): string | undefined {
  const mots = argv.filter((argument) => !argument.startsWith("-"));
  for (const [groupe, commande] of COMMANDES_REFUSEES) {
    const rang = mots.indexOf(groupe);
    if (rang >= 0 && mots[rang + 1] === commande) return `${groupe} ${commande}`;
  }
  return undefined;
}

const refusee = estProduction() ? commandeRefusee(process.argv.slice(2)) : undefined;
if (refusee) {
  throw new Error(
    `« prisma ${refusee} » est refusée en production : elle peut vider ou réécrire la base. ` +
      "Sur le serveur, le schéma ne s'applique que par « prisma migrate deploy » " +
      "(docs/DEPLOIEMENT.md, « Ce qui protège les données de production »).",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
