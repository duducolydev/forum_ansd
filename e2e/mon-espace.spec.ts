import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import {
  COMPTE_CONNU_COOKIE,
  PARTICIPANT_SESSION_COOKIE,
  signParticipantSession,
} from "../src/modules/auth/participant-session";
import { emailE2E } from "./helpers/comptes";
import { pngUni } from "./helpers/image";

/**
 * « Mon espace » (5 novembre 2026) : envoi de la photo, et biographie commune
 * avec la fiche intervenant.
 *
 * La session est posée directement, signée comme le ferait le lien magique :
 * le lien lui-même a ses propres tests, et passer par un e-mail n'apprendrait
 * rien ici.
 */
const EMAIL = emailE2E("mon-espace");

test.afterAll(async () => {
  await prisma.speaker.deleteMany({ where: { participant: { email: EMAIL } } });
  await prisma.participant.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("la photo s'envoie, et la biographie rejoint la fiche intervenant", async ({
  page,
  context,
  baseURL,
}) => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  const categorie = await prisma.participantCategory.findFirstOrThrow({
    where: { editionId: edition.id, code: "PARTICIPANT_NATIONAL" },
  });
  const participant = await prisma.participant.create({
    data: {
      editionId: edition.id,
      publicId: `ESPACE-${Date.now().toString(36).toUpperCase()}`,
      firstName: "Awa",
      lastName: "ESPACE",
      email: EMAIL,
      country: "Sénégal",
      categoryId: categorie.id,
      status: "CONFIRMED",
      bio: "Ancienne biographie.",
      participationDays: [edition.startDate.toISOString().slice(0, 10)],
    },
  });
  const speaker = await prisma.speaker.create({
    data: {
      editionId: edition.id,
      participantId: participant.id,
      firstName: "Awa",
      lastName: "ESPACE",
      bioFr: "Ancienne biographie.",
    },
  });

  const domaine = new URL(baseURL!).hostname;
  await context.addCookies([
    {
      name: PARTICIPANT_SESSION_COOKIE,
      value: await signParticipantSession(participant.id),
      domain: domaine,
      path: "/",
    },
    { name: COMPTE_CONNU_COOKIE, value: "1", domain: domaine, path: "/" },
  ]);

  await page.goto("/mon-espace");

  // --- Photo : une image plus grande que le recadrage, comme d'un téléphone.
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: pngUni(1200, 900, [40, 120, 200]),
    });
  await page.getByRole("button", { name: "Enregistrer la photo" }).click();
  // Délai large pour `next dev` seulement : la photo est écrite dans
  // `./storage`, que le serveur de développement surveille, et chaque écriture
  // y relance une compilation (10 à 30 s mesurées). L'image de production n'a
  // pas de surveillance : l'envoi y répond en une seconde.
  await expect(page.getByText("Photo enregistrée")).toBeVisible({ timeout: 45_000 });

  const avecPhoto = await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } });
  expect(avecPhoto.photoPath).toMatch(
    new RegExp(`^photos/${participant.publicId}-[0-9a-f]{12}\\.jpg$`),
  );
  const servie = await page.request.get(`/api/v1/participants/${participant.id}/photo`);
  expect(servie.status()).toBe(200);
  expect(servie.headers()["content-type"]).toBe("image/jpeg");

  // --- Biographie : modifiée ici, elle est aussi celle de la fiche intervenant.
  const bio = "Statisticienne, responsable des enquêtes ménages à l'ANSD.";
  await page.getByLabel("Biographie").fill(bio);
  await page.getByRole("button", { name: "Enregistrer mes informations" }).click();
  await expect(page.getByText("Vos informations ont été mises à jour.")).toBeVisible({
    timeout: 45_000,
  });

  expect((await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } })).bio).toBe(
    bio,
  );
  expect((await prisma.speaker.findUniqueOrThrow({ where: { id: speaker.id } })).bioFr).toBe(bio);
});
