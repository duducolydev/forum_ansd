import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { emailE2E } from "./helpers/comptes";
import { nettoyerDonneesE2E } from "./helpers/nettoyage";
import { pngUni } from "./helpers/image";
import { accepterConsentements, allerJusquAuBout } from "./helpers/inscription";

/**
 * Envoi de l'inscription publique (30 octobre 2026).
 *
 * Signalé le 29 octobre : une erreur apparaissait « à la dernière étape, avant
 * de cliquer sur Envoyer », et la page entière tombait sur « Application
 * error: a client-side exception has occurred », la console montrant « An
 * unexpected response was received from the server ».
 *
 * Deux défauts, que ce fichier couvre :
 *
 * 1. Le clic sur « Continuer » de l'avant-dernière étape **envoyait le
 *    formulaire** — React recyclait le bouton en bouton d'envoi pendant le
 *    clic. D'où l'erreur avant le clic sur « Envoyer ».
 * 2. Une réponse qui n'est pas du RSC — page HTML d'un pare-feu ou d'un proxy,
 *    502 pendant un redémarrage — faisait tomber la page, formulaire perdu.
 *
 * Le second se rejoue sans réseau à simuler : la requête qui porte une photo
 * reçoit une page HTML, comme d'un équipement qui bloquerait le contenu
 * binaire ; celle qui n'en porte pas passe.
 */
const EMAIL = emailE2E("envoi-interrompu");

test.afterAll(async () => {
  await nettoyerDonneesE2E();
  await prisma.$disconnect();
});

test("seul « Envoyer » envoie ; un envoi rejeté en chemin garde le formulaire, qui aboutit sans la photo", async ({
  page,
}) => {
  let envois = 0;
  let bloques = 0;
  await page.route("**/inscription", async (route) => {
    const requete = route.request();
    if (requete.method() !== "POST" || !requete.headers()["next-action"]) {
      await route.continue();
      return;
    }
    envois++;
    // La photo est le seul fichier de la requête. Son nom de champ ne se teste
    // pas : React le préfixe (`1_photo`) en sérialisant le FormData.
    if (requete.postDataBuffer()?.includes('filename="')) {
      bloques++;
      await route.fulfill({
        status: 403,
        contentType: "text/html",
        body: "<html><body><h1>Web Page Blocked</h1></body></html>",
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/inscription");

  await page.getByLabel("Prénom", { exact: true }).fill("Moussa");
  await page.getByLabel("Nom", { exact: true }).fill("Sarr");
  await page.getByLabel("Adresse e-mail", { exact: true }).fill(EMAIL);
  await page.getByLabel("Pays", { exact: true }).fill("Sénégal");
  await page.getByLabel("Catégorie de participation").selectOption({ label: "Sponsor" });

  await page.getByRole("button", { name: "Continuer" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: pngUni(240, 160, [40, 120, 200]),
  });
  await expect(page.getByRole("img", { name: /Aperçu du cadrage/ })).toBeVisible();

  await allerJusquAuBout(page);
  await accepterConsentements(page);
  // Arrivé sur la dernière étape, consentements cochés : rien n'est encore parti.
  expect(envois).toBe(0);

  await page.getByRole("button", { name: "Envoyer mon inscription" }).click();

  // Le formulaire reste là, avec un message qui dit quoi faire.
  await expect(page.getByText(/L'envoi n'a pas abouti/)).toBeVisible();
  expect(bloques).toBe(1);
  await expect(page.getByText(/Application error/)).toHaveCount(0);
  await expect(page.getByLabel(/J'accepte les conditions/)).toBeChecked();

  await page.getByRole("button", { name: "Envoyer sans la photo" }).click();
  await expect(page.getByText("Inscription enregistrée")).toBeVisible({ timeout: 20_000 });
  expect(envois).toBe(2);

  const edition = await prisma.edition.findFirstOrThrow({ where: { isActive: true } });
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { editionId_email: { editionId: edition.id, email: EMAIL } },
  });
  expect(participant.consentTerms).toBe(true);
  expect(participant.photoPath).toBeNull();
});
