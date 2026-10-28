import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";
import { cliquerPuisConfirmer } from "./helpers/dialogue";

/**
 * Suppression définitive depuis la fiche du BackOffice (28 octobre 2026) : la
 * fiche disparaît pour de bon, et l'adresse peut resservir à une inscription.
 * Le détail de ce qui est effacé est couvert par `suppression.test.ts`.
 */
const SUFFIXE = Date.now().toString(36).toUpperCase();
const EMAIL = `suppression-e2e-${SUFFIXE.toLowerCase()}@example.test`;

test.afterAll(async () => {
  await prisma.participant.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("le comité supprime définitivement un participant depuis sa fiche", async ({ page }) => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  const categorie = await prisma.participantCategory.findFirstOrThrow({
    where: { editionId: edition.id, code: "PARTICIPANT_NATIONAL" },
  });
  const participant = await prisma.participant.create({
    data: {
      editionId: edition.id,
      publicId: `SUPE2E-${SUFFIXE}`,
      firstName: "Awa",
      lastName: `Suppression ${SUFFIXE}`,
      email: EMAIL,
      country: "Sénégal",
      categoryId: categorie.id,
      status: "REGISTERED",
    },
  });

  await seConnecterAdmin(page);
  await page.goto(`/admin/participants/${participant.id}`);
  await cliquerPuisConfirmer(page, { nom: "Supprimer définitivement" });

  await expect(page).toHaveURL(/\/admin\/participants$/);
  await expect(page.getByText("Participant supprimé")).toBeVisible();
  expect(await prisma.participant.findUnique({ where: { id: participant.id } })).toBeNull();
  expect(
    await prisma.participant.findUnique({
      where: { editionId_email: { editionId: edition.id, email: EMAIL } },
    }),
  ).toBeNull();
});
