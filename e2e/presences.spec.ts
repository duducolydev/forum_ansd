import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Présences et export PDF (brief §5.6, PLAN.md 4.6).
 *
 * Le PDF est rendu par Chromium côté serveur : seul un appel à l'application
 * réelle prouve qu'il sort. Un test unitaire sur le gabarit HTML — il en existe
 * un — ne dit rien du rendu lui-même.
 */
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();
const JOUR = "2026-11-24";

let editionId = "";
let categoryId = "";
let zoneId = "";
let checkpointId = "";
const emails: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  editionId = edition.id;

  categoryId = (
    await prisma.participantCategory.create({
      data: {
        editionId,
        code: `CE2E_${SUFFIXE}`,
        labelFr: `Catégorie E2E ${SUFFIXE}`,
        labelEn: `E2E category ${SUFFIXE}`,
        sortOrder: 998,
      },
    })
  ).id;

  zoneId = (
    await prisma.zone.create({
      data: { editionId, code: `ZPE2E${SUFFIXE}`, name: `Zone présences ${SUFFIXE}` },
    })
  ).id;

  checkpointId = (
    await prisma.checkpoint.create({
      data: { editionId, zoneId, name: `Poste présences ${SUFFIXE}` },
    })
  ).id;

  for (const [index, nom] of ["Sow", "Ba", "Diallo"].entries()) {
    const email = `e2e-presence-${randomUUID()}@example.test`;
    emails.push(email);
    const participant = await prisma.participant.create({
      data: {
        editionId,
        publicId: `PE2E-${SUFFIXE}-${index}`,
        firstName: "Aminata",
        lastName: `${nom}${SUFFIXE.slice(0, 3)}`,
        email,
        country: index === 2 ? "Mali" : "Sénégal",
        organization: "ANSD",
        categoryId,
        status: "CONFIRMED",
        source: "ONSITE",
        confirmedAt: new Date(),
      },
    });

    // Deux présents sur trois : il faut un absent pour que le constat ait
    // quelque chose à montrer.
    if (index < 2) {
      await prisma.scanLog.create({
        data: {
          clientScanId: randomUUID(),
          checkpointId,
          participantId: participant.id,
          badgeVersion: 1,
          scannedAt: new Date(`${JOUR}T08:${30 + index}:00.000Z`),
          day: new Date(`${JOUR}T00:00:00.000Z`),
          direction: "IN",
          result: "OK",
        },
      });
    }
  }
});

test.afterAll(async () => {
  await prisma.scanLog.deleteMany({ where: { checkpointId } });
  await prisma.checkpoint.deleteMany({ where: { id: checkpointId } });
  await prisma.participant.deleteMany({ where: { email: { in: emails } } });
  await prisma.zone.deleteMany({ where: { id: zoneId } });
  await prisma.participantCategory.deleteMany({ where: { id: categoryId } });
  await prisma.$disconnect();
});

test("affiche les taux du jour et le flux des scans", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/presences?jour=${JOUR}`);

  await expect(page.getByRole("heading", { name: "Présences" })).toBeVisible();

  const ligne = page.getByRole("row", { name: new RegExp(`Catégorie E2E ${SUFFIXE}`) });
  await expect(ligne).toContainText("66.7 %");

  await expect(page.getByRole("heading", { name: "Flux des scans" })).toBeVisible();
  await expect(page.getByText(`Poste présences ${SUFFIXE}`).first()).toBeVisible();
});

test("produit une feuille d'émargement et une liste de présence en PDF", async ({ page }) => {
  await seConnecterAdmin(page);

  const emargement = await page.request.get(
    `/api/v1/presences/export?jour=${JOUR}&forme=EMARGEMENT&categoryId=${categoryId}`,
  );
  expect(emargement.status()).toBe(200);
  expect(emargement.headers()["content-type"]).toContain("application/pdf");
  const octets = await emargement.body();
  expect(octets.subarray(0, 4).toString()).toBe("%PDF");
  // Un PDF d'une page avec trois lignes pèse quelques kilo-octets ; en dessous,
  // c'est un document vide qu'on aurait servi sans s'en apercevoir.
  expect(octets.length).toBeGreaterThan(2000);

  const constat = await page.request.get(
    `/api/v1/presences/export?jour=${JOUR}&forme=CONSTAT&categoryId=${categoryId}`,
  );
  expect(constat.status()).toBe(200);
  expect(constat.headers()["content-disposition"]).toContain(`presences-${JOUR}-constat.pdf`);
});

test("refuse un jour mal formé plutôt que de rendre un document vide", async ({ page }) => {
  await seConnecterAdmin(page);
  const reponse = await page.request.get("/api/v1/presences/export?jour=hier");
  expect(reponse.status()).toBe(400);
});

test("ferme l'export et le flux aux sessions sans permission", async ({ request }) => {
  expect((await request.get(`/api/v1/presences/export?jour=${JOUR}`)).status()).toBe(401);
  expect((await request.get("/api/v1/presences/flux")).status()).toBe(401);
});
