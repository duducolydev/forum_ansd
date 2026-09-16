import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Le scanner remplit les conditions d'installation de Chrome (PLAN.md §16.7).
 *
 * Plutôt que de supposer qu'un manifeste bien formé suffit, le test lit la liste
 * des obstacles que Chrome lui-même tient à jour, par son protocole de débogage
 * (`Page.getInstallabilityErrors`). Elle doit être vide.
 *
 * Profil **persistant** : les contextes ordinaires de Playwright sont des
 * sessions privées, et « session privée » figure justement parmi les obstacles.
 * Le test mesurerait le navigateur de test, pas l'application.
 */

const CHROME_SYSTEME = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((chemin) => existsSync(chemin));

test.describe.configure({ timeout: 120_000 });

test("le scanner est installable comme application, sans obstacle signalé par Chrome", async ({
  baseURL,
}) => {
  const profil = mkdtempSync(join(tmpdir(), "forum-scan-installation-"));
  const contexte = await chromium.launchPersistentContext(profil, {
    ...(CHROME_SYSTEME ? { executablePath: CHROME_SYSTEME } : {}),
    baseURL,
    locale: "fr-FR",
  });

  try {
    const page = contexte.pages()[0] ?? (await contexte.newPage());
    await seConnecterAdmin(page);
    await page.goto("/scan");

    // Le service worker compte parmi les conditions : on attend qu'il soit actif.
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));

    const cdp = await contexte.newCDPSession(page);

    const manifeste = (await cdp.send("Page.getAppManifest")) as {
      errors: { message: string }[];
    };
    expect(manifeste.errors, JSON.stringify(manifeste.errors)).toEqual([]);

    await expect
      .poll(
        async () => {
          const reponse = (await cdp.send("Page.getInstallabilityErrors")) as {
            installabilityErrors: { errorId: string }[];
          };
          return reponse.installabilityErrors.map((erreur) => erreur.errorId);
        },
        { timeout: 30_000, message: "Chrome ne doit signaler aucun obstacle à l'installation" },
      )
      .toEqual([]);

    // iOS lit sa propre icône, hors manifeste.
    const iconeApple = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    expect(iconeApple).toBeTruthy();
    const reponse = await page.request.get(iconeApple!);
    expect(reponse.status()).toBe(200);
    expect(reponse.headers()["content-type"]).toContain("image/png");
  } finally {
    await contexte.close();
    rmSync(profil, { recursive: true, force: true });
  }
});
