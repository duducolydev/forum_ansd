/**
 * Reconnaître la production (19 octobre 2026).
 *
 * Les outils qui écrivent des données de démonstration, ou qui peuvent vider la
 * base, refusent de s'exécuter en production : le seed de démonstration,
 * `pnpm comptes:demo`, et les commandes Prisma destructrices
 * (`prisma.config.ts`).
 *
 * Deux signaux, l'un ou l'autre suffit :
 *
 * - `APP_ENV=production`, écrit en dur dans `docker-compose.prod.yml` pour
 *   l'application et pour le service `outils`. Toute commande lancée sur le
 *   serveur par `forum run --rm outils …` le porte, sans dépendre du `.env`.
 * - Une adresse publique sur le domaine de l'ANSD (`PUBLIC_BASE_URL`), pour une
 *   commande lancée hors de Compose avec le `.env` du serveur chargé à la main.
 *
 * Le second signal ratisse large à dessein : une recette montée un jour sur un
 * sous-domaine de l'ANSD serait traitée comme la production. Se tromper dans ce
 * sens-là coûte un refus ; dans l'autre, des inscriptions.
 */
export function estProduction(env: Record<string, string | undefined> = process.env): boolean {
  if (env.APP_ENV?.trim().toLowerCase() === "production") return true;

  const adresse = env.PUBLIC_BASE_URL?.trim();
  if (!adresse) return false;
  try {
    const hote = new URL(adresse).hostname.toLowerCase();
    return hote === "ansd.sn" || hote.endsWith(".ansd.sn");
  } catch {
    return false;
  }
}
