import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ensureAdminE2E, seConnecterAdmin, validerConnexion } from "./helpers/comptes";

/**
 * La caméra du scanner et du comptoir d'accueil, éprouvée avec une caméra
 * simulée (PLAN.md §16).
 *
 * Le test historique du scanner ne pilote pas de caméra et se contente de lire
 * l'en-tête `Permissions-Policy` de `/scan` chargé directement — précisément le
 * seul chemin qui fonctionnait. Le défaut signalé passait par un autre : l'agent
 * se connecte, arrive sur `/admin`, puis ouvre « Scanner » depuis le menu. La
 * navigation interne gardait la politique du document de départ, qui refuse la
 * caméra. Reproduit ici avant correction : `politique: false, flux: false`.
 *
 * Chrome est lancé avec un périphérique vidéo factice : la caméra « existe », et
 * l'autorisation est accordée sans boîte de dialogue. Si le flux ne démarre pas,
 * ce n'est donc ni l'absence de caméra ni un refus de l'utilisateur.
 */

const CHROME_SYSTEME = [
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/bin/google-chrome",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((chemin) => existsSync(chemin));

test.use({
  launchOptions: {
    ...(CHROME_SYSTEME ? { executablePath: CHROME_SYSTEME } : {}),
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
  permissions: ["camera"],
});

test.describe.configure({ timeout: 120_000 });

interface EtatCamera {
  /** Ce que la politique du **document** autorise ; `null` si le navigateur ne l'expose pas. */
  politique: boolean | null;
  flux: boolean;
}

async function etatCamera(page: Page): Promise<EtatCamera> {
  return page.evaluate(() => {
    const doc = document as Document & {
      permissionsPolicy?: { allowsFeature(nom: string): boolean };
      featurePolicy?: { allowsFeature(nom: string): boolean };
    };
    const politique = doc.permissionsPolicy ?? doc.featurePolicy;
    const video = document.querySelector("video");
    return {
      politique: politique ? politique.allowsFeature("camera") : null,
      flux: Boolean(video?.srcObject),
    };
  });
}

async function attendreCameraActive(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const etat = await etatCamera(page);
        return etat.flux ? "active" : JSON.stringify(etat);
      },
      { timeout: 30_000, message: "le flux vidéo du scanner doit démarrer" },
    )
    .toBe("active");
}

test("chargé directement, le scanner allume la caméra", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/scan");
  await attendreCameraActive(page);
});

test("ouvert depuis le menu du BackOffice, le scanner allume aussi la caméra", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin");
  await page.getByRole("link", { name: "Scanner" }).click();
  await page.waitForURL(/\/scan$/);
  await attendreCameraActive(page);
});

test("ouvert depuis le menu, le comptoir d'accueil a le droit d'utiliser la caméra", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto("/admin");
  await page.getByRole("link", { name: "Accueil", exact: true }).click();
  await page.waitForURL(/\/admin\/accueil$/);
  await expect.poll(async () => (await etatCamera(page)).politique).toBe(true);
});

test("un agent qui ouvre /scan revient au scanner après la connexion, caméra allumée", async ({
  page,
}) => {
  const userId = await ensureAdminE2E();

  // Sans session : le middleware renvoie vers la connexion, avec la destination.
  await page.goto("/scan");
  await expect(page).toHaveURL(/\/connexion\?callbackUrl=/);

  await validerConnexion(page, userId, /\/scan$/);

  await attendreCameraActive(page);
});
