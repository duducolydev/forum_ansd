import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { emailE2E, seConnecterAdmin } from "./helpers/comptes";
import { confirmerBoite } from "./helpers/dialogue";
import { pngUni } from "./helpers/image";

/**
 * Photo déposée par le comité (9 novembre 2026), pour les personnes qui ne le
 * font pas elles-mêmes : ministres, directeurs généraux…
 *
 * Déposée depuis la fiche participant d'une personne qui a aussi une fiche
 * intervenant, elle arrive sur les deux ; le badge lit l'une, le site l'autre.
 */
const EMAIL = emailE2E("photo-comite");

test.afterAll(async () => {
  await prisma.speaker.deleteMany({ where: { participant: { email: EMAIL } } });
  await prisma.participant.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("le comité dépose puis retire la photo depuis la fiche", async ({ page }) => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  const categorie = await prisma.participantCategory.findFirstOrThrow({
    where: { editionId: edition.id, code: "PARTICIPANT_NATIONAL" },
  });
  const participant = await prisma.participant.create({
    data: {
      editionId: edition.id,
      publicId: `COMITE-${Date.now().toString(36).toUpperCase()}`,
      firstName: "Awa",
      lastName: "COMITE",
      email: EMAIL,
      country: "Sénégal",
      categoryId: categorie.id,
      status: "CONFIRMED",
    },
  });
  const speaker = await prisma.speaker.create({
    data: {
      editionId: edition.id,
      participantId: participant.id,
      firstName: "Awa",
      lastName: "COMITE",
    },
  });

  await seConnecterAdmin(page);

  // Depuis la fiche ouverte, un lien mène au dépôt.
  await page.goto(`/admin/participants/${participant.id}`);
  await page.getByRole("link", { name: "Ajouter une photo" }).click();
  // Délai large : `next dev` compile la page à sa première ouverture.
  await expect(page).toHaveURL(
    new RegExp(`/admin/participants/${participant.id}/modifier#photo$`),
    {
      timeout: 60_000,
    },
  );

  const bloc = page.locator("#photo");
  await bloc.locator('input[type="file"]').setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: pngUni(1200, 900, [40, 120, 200]),
  });
  await bloc.getByRole("button", { name: "Enregistrer la photo" }).click();
  // Délai large pour `next dev` seulement : écrire dans `./storage`, qu'il
  // surveille, relance une compilation.
  await expect(bloc.getByText("Photo enregistrée.")).toBeVisible({ timeout: 90_000 });

  const lire = async () => ({
    participant: (await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } }))
      .photoPath,
    speaker: (await prisma.speaker.findUniqueOrThrow({ where: { id: speaker.id } })).photoPath,
  });
  const avecPhoto = await lire();
  expect(avecPhoto.participant).toMatch(/^photos\/.+\.jpg$/);
  expect(avecPhoto.speaker).toMatch(/^speakers\/.+\.jpg$/);

  // La fiche intervenant la montre aussi, et la photo enregistrée est servie.
  await page.goto(`/admin/intervenants/${speaker.id}/modifier`);
  await expect(page.locator("#photo img")).toHaveAttribute("src", /\/api\/v1\/speakers\/.+\?v=/);
  const servie = await page.request.get(`/api/v1/speakers/${speaker.id}/photo`);
  expect(servie.status()).toBe(200);
  expect(servie.headers()["content-type"]).toBe("image/jpeg");

  // Retirée depuis la fiche intervenant : elle quitte les deux fiches.
  await page.locator("#photo").getByRole("button", { name: "Retirer la photo" }).click();
  await confirmerBoite(page);
  await expect(page.locator("#photo").getByText("Photo retirée.")).toBeVisible({
    timeout: 90_000,
  });
  expect(await lire()).toEqual({ participant: null, speaker: null });
});
