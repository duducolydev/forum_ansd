import { expect, test } from "@playwright/test";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Rapports et exports (brief §5.13, PLAN.md 4.9).
 *
 * Chaque rapport doit sortir dans les trois formats **depuis l'application
 * réelle** : le XLSX passe par SheetJS et le PDF par Chromium, deux chemins
 * qu'un test sur les fonctions de mise en forme n'éprouve pas.
 */
const RAPPORTS = [
  "participants",
  "presences",
  "sessions",
  "entonnoir",
  "repartition",
  "delegations",
  "badges",
];

test("l'écran liste les rapports et annonce leur volume", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/rapports");

  await expect(page.getByRole("heading", { name: "Rapports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Participants" })).toBeVisible();
  // Le nombre de lignes est affiché avant le clic : on doit savoir si l'on
  // télécharge dix lignes ou mille.
  await expect(page.getByText(/ligne\(s\)/).first()).toBeVisible();
});

test("chaque rapport sort en CSV et en XLSX", async ({ page }) => {
  await seConnecterAdmin(page);

  for (const rapport of RAPPORTS) {
    const csv = await page.request.get(`/api/v1/rapports/${rapport}?format=csv`);
    expect(csv.status(), `CSV ${rapport}`).toBe(200);
    const texte = await csv.text();
    // BOM UTF-8 en tête, sinon Excel massacre les accents.
    expect(texte.charCodeAt(0), `BOM ${rapport}`).toBe(0xfeff);

    const xlsx = await page.request.get(`/api/v1/rapports/${rapport}?format=xlsx`);
    expect(xlsx.status(), `XLSX ${rapport}`).toBe(200);
    // « PK » : un .xlsx est une archive ZIP.
    expect((await xlsx.body()).subarray(0, 2).toString(), `entête XLSX ${rapport}`).toBe("PK");
  }
});

test("le rapport des participants sort aussi en PDF", async ({ page }) => {
  await seConnecterAdmin(page);

  const pdf = await page.request.get("/api/v1/rapports/participants?format=pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  // Le nombre de lignes voyage en en-tête : il vaut pour le fichier complet,
  // même quand le PDF est borné.
  expect(Number(pdf.headers()["x-rapport-lignes"])).toBeGreaterThan(0);
});

test("retombe sur XLSX pour un format inconnu, et refuse un rapport inconnu", async ({ page }) => {
  await seConnecterAdmin(page);

  const inventé = await page.request.get("/api/v1/rapports/participants?format=exe");
  expect(inventé.status()).toBe(200);
  expect(inventé.headers()["content-type"]).toContain("spreadsheetml");

  expect((await page.request.get("/api/v1/rapports/inexistant")).status()).toBe(404);
});

test("l'export est fermé aux sessions sans permission", async ({ request }) => {
  expect((await request.get("/api/v1/rapports/participants?format=csv")).status()).toBe(401);
});
