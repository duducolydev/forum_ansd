import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { emailE2E } from "./helpers/comptes";
import { nettoyerDonneesE2E } from "./helpers/nettoyage";
import { pngUni } from "./helpers/image";
import { accepterConsentements, allerJusquAuBout, choisirPays } from "./helpers/inscription";

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
 * Le second se rejoue sans réseau à simuler : le premier envoi reçoit une
 * page HTML, comme d'un équipement qui bloquerait la requête au passage.
 *
 * Le formulaire ne propose plus d'« Envoyer sans la photo » (retiré le 30
 * octobre, `dc9365b`) : après un refus, on réessaie le même envoi, photo
 * comprise. Le test rejoue donc une coupure passagère — le second essai passe
 * et l'inscription arrive avec sa photo.
 */
const EMAIL = emailE2E("envoi-interrompu");

test.afterAll(async () => {
  await nettoyerDonneesE2E();
  await prisma.$disconnect();
});

test("seul « Envoyer » envoie ; un envoi rejeté en chemin garde le formulaire, et un nouvel essai aboutit", async ({
  page,
}) => {
  let envois = 0;
  let bloques = 0;
  // Coupure passagère : seul le premier envoi est bloqué.
  let bloquer = true;
  await page.route("**/inscription", async (route) => {
    const requete = route.request();
    if (requete.method() !== "POST" || !requete.headers()["next-action"]) {
      await route.continue();
      return;
    }
    envois++;
    if (bloquer) {
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
  await choisirPays(page, "Sénégal");
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

  // Le passage se rétablit ; on renvoie le même formulaire, sans rien ressaisir.
  bloquer = false;
  await page.getByRole("button", { name: "Envoyer mon inscription" }).click();
  // Délai large pour `next dev` seulement : la photo est écrite dans
  // `./storage`, que le serveur de développement surveille, et l'écriture y
  // relance une compilation (jusqu'à 40 s mesurées). L'image de production n'a
  // pas de surveillance.
  await expect(page.getByText("Inscription enregistrée")).toBeVisible({ timeout: 90_000 });
  expect(envois).toBe(2);
  expect(bloques).toBe(1);

  const edition = await prisma.edition.findFirstOrThrow({ where: { isActive: true } });
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { editionId_email: { editionId: edition.id, email: EMAIL } },
  });
  expect(participant.consentTerms).toBe(true);
  // La photo choisie avant la coupure est arrivée avec le second envoi.
  expect(participant.photoPath).toMatch(
    new RegExp(`^photos/${participant.publicId}-[0-9a-f]{12}\\.jpg$`),
  );
});
