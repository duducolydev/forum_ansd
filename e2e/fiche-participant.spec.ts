import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { emailE2E, seConnecterAdmin } from "./helpers/comptes";

/**
 * Fiche « Modifier » du BackOffice (29 octobre 2026). Après l'enregistrement,
 * le formulaire se réinitialisait sur les valeurs d'avant : la catégorie
 * changée y réapparaissait inchangée, et un second clic la remettait en base.
 * Il remettait aussi à zéro ce qu'il ne montre pas (langue, cérémonies,
 * régime).
 */
const EMAIL = emailE2E("fiche-categorie");

test.afterAll(async () => {
  await prisma.participant.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

test("changer la catégorie ramène à la fiche, le reste du dossier intact", async ({ page }) => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  const [personnel, invite] = await Promise.all(
    ["PERSONNEL_ANSD", "INVITE_SPECIAL"].map((code) =>
      prisma.participantCategory.findFirstOrThrow({ where: { editionId: edition.id, code } }),
    ),
  );
  const participant = await prisma.participant.create({
    data: {
      editionId: edition.id,
      publicId: `FICHE-${Date.now().toString(36).toUpperCase()}`,
      firstName: "Awa",
      lastName: "FICHE",
      email: EMAIL,
      country: "Sénégal",
      categoryId: personnel!.id,
      status: "CONFIRMED",
      locale: "en",
      attendsOpening: true,
      dietaryRequirements: "Végétarien",
    },
  });

  await seConnecterAdmin(page);
  await page.goto(`/admin/participants/${participant.id}/modifier`);
  await page.getByLabel("Catégorie").selectOption({ label: invite!.labelFr });
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/participants/${participant.id}$`));
  await expect(page.getByText(invite!.labelFr).first()).toBeVisible();

  const apres = await prisma.participant.findUniqueOrThrow({ where: { id: participant.id } });
  expect(apres.categoryId).toBe(invite!.id);
  expect(apres.locale).toBe("en");
  expect(apres.attendsOpening).toBe(true);
  expect(apres.dietaryRequirements).toBe("Végétarien");
});
