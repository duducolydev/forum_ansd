// Chargé ici et non dans un helper : les fichiers de test importent `src/lib/db`,
// qui lit DATABASE_URL à l'évaluation du module — donc avant qu'un helper n'ait
// eu l'occasion d'appeler dotenv.
import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * Tests de bout en bout (brief §5.3, PLAN.md T25).
 *
 * Ils visent le parcours nommé par le critère de sortie du Lot 1 —
 * inscription → confirmation → badge — et les gardes qui le protègent.
 *
 * Pourquoi ces tests existent : trois défauts sérieux ont été trouvés en
 * pilotant un navigateur à la main, **aucun** par le typecheck, le lint ou les
 * 87 tests unitaires et d'intégration : l'envoi groupé qui ne partait pas,
 * `/admin` déprotégé par le middleware, et plus aucune connexion possible.
 * Ces trois-là sont désormais couverts ici.
 *
 * Ils s'exécutent contre une application **déjà démarrée** (l'image Docker de
 * production, cf. README) plutôt que contre un serveur lancé par Playwright :
 * c'est l'artefact réellement livré qu'on veut éprouver, pas un `next dev`.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3010";

/** Chrome du système : évite de télécharger un navigateur de plus (~150 Mo). */
const SYSTEM_CHROME = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => existsSync(path));

export default defineConfig({
  testDir: "./e2e",
  // Ces tests écrivent en base (inscriptions, badges) : les faire tourner en
  // parallèle rendrait les comptages non déterministes.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    timezoneId: "Africa/Dakar",
    // Trace conservée au premier échec : de quoi comprendre sans rejouer.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(SYSTEM_CHROME ? { launchOptions: { executablePath: SYSTEM_CHROME } } : {}),
      },
    },
  ],
});
