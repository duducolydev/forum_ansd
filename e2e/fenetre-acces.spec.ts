import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { variablesAccesDirect } from "../src/modules/auth/acces-direct";
import { emailE2E } from "./helpers/comptes";

/**
 * Fenêtre des conditions d'accès de l'accueil (26 octobre 2026).
 *
 * Elle revient à chaque ouverture du navigateur, tant qu'aucun compte
 * participant ne s'y est connecté : la connexion prouve que le compte existe.
 * « Rouvrir le navigateur » se simule en ne gardant que les cookies persistants
 * — c'est exactement ce que fait un navigateur qu'on ferme.
 */
const TITRE = "Inscription obligatoire pour accéder au Forum";
let participantId = "";

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  const categorie = await prisma.participantCategory.findFirstOrThrow({
    where: { editionId: edition.id, code: "PARTICIPANT_NATIONAL" },
  });
  participantId = (
    await prisma.participant.create({
      data: {
        editionId: edition.id,
        publicId: `FEN-${Date.now().toString(36).toUpperCase()}`,
        firstName: "Awa",
        lastName: "Fenetre",
        email: emailE2E("fenetre"),
        country: "Sénégal",
        categoryId: categorie.id,
        status: "CONFIRMED",
        source: "ONSITE",
        confirmedAt: new Date(),
      },
    })
  ).id;
});

test.afterAll(async () => {
  await prisma.participant.deleteMany({ where: { id: participantId } });
});

async function rouvrir(contexte: BrowserContext, navigateur: Browser): Promise<BrowserContext> {
  const etat = await contexte.storageState();
  await contexte.close();
  return navigateur.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: { cookies: etat.cookies.filter((cookie) => cookie.expires > 0), origins: [] },
  });
}

/** La fenêtre s'ouvre après un court délai : on l'attend avant de conclure à son absence. */
async function fenetreVisible(contexte: BrowserContext): Promise<boolean> {
  const page = await contexte.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  const visible = await page.getByRole("heading", { name: TITRE }).isVisible();
  await page.close();
  return visible;
}

test("revient à chaque ouverture du navigateur, jusqu'à la première connexion", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const baseURL = test.info().project.use.baseURL;

  let contexte = await browser.newContext({ baseURL });
  const page = await contexte.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: TITRE })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/validation de votre inscription se fera ensuite/)).toBeVisible();
  await page.getByRole("button", { name: "Plus tard" }).click();

  // Même session du navigateur : ni au rechargement, ni dans un autre onglet.
  await page.reload();
  await page.waitForTimeout(3000);
  expect(await page.getByRole("heading", { name: TITRE }).isVisible()).toBe(false);
  expect(await fenetreVisible(contexte)).toBe(false);

  // Navigateur rouvert : elle revient.
  contexte = await rouvrir(contexte, browser);
  expect(await fenetreVisible(contexte)).toBe(true);

  // Connexion à l'espace participant : plus de fenêtre…
  const espace = await contexte.newPage();
  const { lien_espace } = await variablesAccesDirect(participantId, { avecCode: false });
  await espace.goto(lien_espace);
  const deconnexion = espace.getByRole("button", { name: "Se déconnecter" });
  await expect(deconnexion.first()).toBeVisible();
  expect(await fenetreVisible(contexte)).toBe(false);

  // … ni après la déconnexion, navigateur rouvert.
  await deconnexion.first().click();
  await expect(deconnexion).toHaveCount(0, { timeout: 30_000 });
  contexte = await rouvrir(contexte, browser);
  expect(await fenetreVisible(contexte)).toBe(false);
  await contexte.close();
});

test("ne s'affiche pas sur une session ouverte avant la mémoire du compte", async ({ browser }) => {
  const contexte = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const page = await contexte.newPage();
  const { lien_espace } = await variablesAccesDirect(participantId, { avecCode: false });
  await page.goto(lien_espace);
  await contexte.clearCookies({ name: "forum-compte-connu" });
  expect(await fenetreVisible(contexte)).toBe(false);
  await contexte.close();
});
