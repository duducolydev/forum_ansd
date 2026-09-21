import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Campagne d'invitations depuis le BackOffice (PLAN.md §22).
 *
 * Le parcours passe par le bouton et sa confirmation, comme un gestionnaire :
 * c'est là que se voient les défauts qui comptent — un filtre ignoré, qui
 * enverrait la campagne à toute la base, ou une confirmation absente devant un
 * geste irréversible.
 *
 * Il travaille sur **sa propre catégorie**, créée puis supprimée : sans elle, la
 * campagne viserait les invitations réelles de l'édition.
 */

test.describe.configure({ mode: "serial", timeout: 180_000 });

const CODE_CATEGORIE = `E2E-CAMPAGNE-${randomUUID().slice(0, 8)}`;
let categorieId = "";
let editionId = "";
const debut = new Date();

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { isActive: true } });
  editionId = edition.id;
  const categorie = await prisma.participantCategory.create({
    data: {
      editionId,
      code: CODE_CATEGORIE,
      labelFr: `Campagne E2E ${CODE_CATEGORIE.slice(-4)}`,
      labelEn: "E2E campaign",
      /*
       * Active, et c'est nécessaire : le formulaire d'envoi ne propose que les
       * catégories actives. Créée inactive, elle n'apparaissait pas dans la
       * liste et le test échouait sur « did not find some options ». Elle est
       * supprimée à la fin, et placée en queue de liste entre-temps.
       */
      isActive: true,
      sortOrder: 999,
    },
  });
  categorieId = categorie.id;

  await prisma.invitation.createMany({
    data: [1, 2].map((numero) => ({
      editionId,
      categoryId: categorieId,
      email: `e2e-campagne-${numero}-${randomUUID()}@example.test`,
      firstName: `Invité${numero}`,
      lastName: "Campagne",
      token: randomUUID().replaceAll("-", ""),
    })),
  });
});

test.afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: {
      action: { in: ["invitation.bulk_send_queued", "invitation.send_queued"] },
      entityId: editionId,
      createdAt: { gte: debut },
    },
  });
  await prisma.invitation.deleteMany({ where: { categoryId: categorieId } });
  await prisma.participantCategory.deleteMany({ where: { id: categorieId } });
  await prisma.$disconnect();
});

test("une campagne part sur la catégorie choisie, après confirmation", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/invitations");

  // La catégorie de ce test seulement : sans ce filtre, la campagne viserait
  // toutes les invitations en attente de l'édition.
  await page
    .locator("#envois-category")
    .selectOption({ label: `Campagne E2E ${CODE_CATEGORIE.slice(-4)}` });

  const bouton = page.getByRole("button", { name: /Envoyer les invitations en attente/ });
  await expect(bouton).toBeEnabled();
  await bouton.click();

  // Geste irréversible : la confirmation annonce la cadence.
  await expect(page.locator(".swal2-popup")).toContainText(/par minute/);
  await page.locator(".swal2-confirm").click();

  await expect(page.getByText(/2 invitation\(s\) mise\(s\) en file/)).toBeVisible();

  // Une trace par campagne, avec son décompte — et non une par destinataire.
  const traces = await prisma.auditLog.findMany({
    where: {
      action: "invitation.bulk_send_queued",
      entityId: editionId,
      createdAt: { gte: debut },
    },
  });
  expect(traces).toHaveLength(1);
  expect((traces[0]!.after as { queued: number }).queued).toBe(2);
});

test("les invitations déjà envoyées ne repartent pas dans la campagne", async ({ page }) => {
  // Les deux invitations du test sont passées à « envoyée » par la campagne
  // précédente une fois la file traitée ; on force l'état pour ne pas dépendre
  // du cadencement.
  await prisma.invitation.updateMany({
    where: { categoryId: categorieId },
    data: { status: "SENT", sentAt: new Date() },
  });

  await seConnecterAdmin(page);
  await page.goto("/admin/invitations");
  await page
    .locator("#envois-category")
    .selectOption({ label: `Campagne E2E ${CODE_CATEGORIE.slice(-4)}` });
  await page.getByRole("button", { name: /Envoyer les invitations en attente/ }).click();
  await page.locator(".swal2-confirm").click();

  await expect(page.getByText(/Aucune invitation en attente pour ce filtre/)).toBeVisible();
});
