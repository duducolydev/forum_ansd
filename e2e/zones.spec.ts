import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";
import { confirmerBoite } from "./helpers/dialogue";

/**
 * Zones d'accès et matrice (brief §2.6, PLAN.md 4.1).
 *
 * Le test travaille sur une zone qu'il crée lui-même et supprime à la fin : la
 * matrice de l'édition est partagée avec le jeu de démonstration, et un test
 * qui décoche une case réelle fausserait tout ce qui suit.
 */
const CODE = `E2E${Date.now()}`;
const NOM = `Zone E2E ${CODE}`;

/**
 * L'écran empile plusieurs formulaires qui partagent des noms de champs
 * (`name`, `zoneId`). Chacun se distingue par un champ qui n'appartient qu'à
 * lui — plus sûr que de compter les positions.
 */
const formulairesZone = (page: Page) =>
  page.locator("form").filter({ has: page.locator('input[name="code"]') });
const formulairesPoint = (page: Page) =>
  page.locator("form").filter({ has: page.locator('input[name="deviceLabel"]') });

/** Les champs sont non contrôlés : leur valeur est dans l'attribut HTML. */
const champValant = (nom: string, valeur: string) => `input[name="${nom}"][value="${valeur}"]`;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  // Filet de sécurité : si un test échoue avant la suppression par l'écran,
  // la zone ne doit pas rester en base pour l'exécution suivante.
  // Les points de contrôle d'abord : la zone est protégée par une clé étrangère,
  // c'est précisément ce que vérifie le dernier test.
  await prisma.checkpoint.deleteMany({ where: { zone: { code: { startsWith: "E2E" } } } });
  await prisma.zone.deleteMany({ where: { code: { startsWith: "E2E" } } });
  await prisma.$disconnect();
});

test("crée une zone, ouvre une case de matrice et la voit persister", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/zones");

  await expect(page.getByRole("heading", { name: "Zones d'accès" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "ENTREE" })).toBeVisible();

  const creation = formulairesZone(page).last();
  await creation.locator('input[name="code"]').fill(CODE);
  await creation.locator('input[name="name"]').fill(NOM);
  await creation.getByRole("button", { name: "Ajouter" }).click();

  await expect(page.getByRole("columnheader", { name: CODE })).toBeVisible();

  const caseSponsor = page.getByLabel(`Sponsor — ${NOM}`);
  await expect(caseSponsor).not.toBeChecked();
  await caseSponsor.check();
  await page.getByRole("button", { name: "Enregistrer la matrice" }).click();
  await expect(page.getByText(/1 ouverture\(s\)/)).toBeVisible();

  // Rechargement : c'est la base qu'on interroge, pas l'état du navigateur.
  await page.reload();
  await expect(page.getByLabel(`Sponsor — ${NOM}`)).toBeChecked();
});

test("accorde puis retire une exception individuelle", async ({ page }) => {
  const participant = await prisma.participant.findFirstOrThrow({
    where: { email: { startsWith: "demo." } },
    select: { publicId: true },
  });

  await seConnecterAdmin(page);
  await page.goto("/admin/zones");

  await page.getByLabel("Identifiant participant").fill(participant.publicId);
  await page.getByLabel("Zone accordée").selectOption({ label: NOM });
  await page.getByLabel("Motif (obligatoire)").fill("Accès ponctuel accordé par le test E2E");
  await page.getByRole("button", { name: "Accorder" }).click();

  const ligne = page.getByRole("row", { name: new RegExp(participant.publicId) });
  await expect(ligne).toContainText("Accès ponctuel accordé par le test E2E");
  await expect(ligne).toContainText(NOM);

  await ligne.getByRole("button", { name: "Retirer" }).click();
  await confirmerBoite(page);
  await expect(page.getByRole("row", { name: new RegExp(participant.publicId) })).toHaveCount(0);
});

test("protège une zone tant qu'un point de contrôle y est rattaché", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/zones");

  const creationPoint = formulairesPoint(page).last();
  await creationPoint.locator('input[name="name"]').fill(`Poste E2E ${CODE}`);
  await creationPoint.locator('select[name="zoneId"]').selectOption({ label: NOM });
  await creationPoint.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.locator(champValant("name", `Poste E2E ${CODE}`))).toBeVisible();

  const zone = formulairesZone(page).filter({ has: page.locator(champValant("code", CODE)) });
  await zone.getByRole("button", { name: "Supprimer" }).click();
  await confirmerBoite(page);
  await expect(zone).toContainText(/point\(s\) de contrôle/);

  // On retire le point, puis la zone part sans résistance.
  const point = formulairesPoint(page).filter({
    has: page.locator(champValant("name", `Poste E2E ${CODE}`)),
  });
  await point.getByRole("button", { name: "Supprimer" }).click();
  await confirmerBoite(page);
  await expect(page.locator(champValant("name", `Poste E2E ${CODE}`))).toHaveCount(0);

  await formulairesZone(page)
    .filter({ has: page.locator(champValant("code", CODE)) })
    .getByRole("button", { name: "Supprimer" })
    .click();
  await confirmerBoite(page);
  await expect(page.getByRole("columnheader", { name: CODE })).toHaveCount(0);
});
