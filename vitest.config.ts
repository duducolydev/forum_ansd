import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // `tsconfig` garde le JSX tel quel (`preserve`), pour Next. Les tests qui
  // rendent un composant ont besoin qu'il soit transformé : runtime automatique,
  // sans `import React` dans chaque fichier. Vite 8 transforme avec Oxc — une
  // option `esbuild` serait ignorée, ce qu'il signale d'ailleurs à l'exécution.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    // `e2e/` appartient à Playwright (`pnpm e2e`). Sans cette exclusion, Vitest
    // ramassait ses fichiers et échouait sur `test.describe()`, qui n'a pas le
    // même sens dans les deux outils.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "e2e/**"],
    // Tests d'intégration (DB réelle + argon2, volontairement lent) exécutés
    // en parallèle entre fichiers : la contention CPU peut dépasser le défaut
    // de 5 s sans que ce soit un bug applicatif.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Trois fichiers de front au plus. Ces tests frappent une vraie base, hachent
    // avec argon2 et rendent des PDF : lancés tous en parallèle sur une machine
    // déjà chargée (conteneurs, navigateur), ils s'affamaient mutuellement et
    // échouaient sur le délai — un échec qui n'apprend rien et finit par être
    // ignoré. Les mêmes fichiers passent isolément.
    maxWorkers: 3,
    env: {
      // Un seul onglet Chromium pendant les tests. Le pool à 4 onglets sert la
      // production ; dans la suite, il affamait les fichiers voisins (argon2
      // notamment) au point de les faire expirer. Le débit de rendu est mesuré
      // par `pnpm bench:badges`, hors suite, où la mesure a du sens.
      PDF_RENDER_CONCURRENCY: "1",
    },
  },
});
