import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { emailE2E } from "./helpers/comptes";
import { accepterConsentements, allerJusquAuBout } from "./helpers/inscription";

/**
 * Inscription sur invitation (29 octobre 2026) : la catégorie choisie par le
 * comité est préremplie et affichée en lecture seule, même quand elle n'est
 * pas proposée au public, et l'invité va jusqu'au bout. Elle passait par une
 * liste désactivée, que le formulaire n'envoyait pas : l'invité restait bloqué
 * sur « La catégorie de participation est requise ».
 */
const SUFFIXE = Date.now().toString(36).toUpperCase();
const EMAIL = emailE2E("invitation-categorie");
const LIBELLE = `Comité E2E ${SUFFIXE}`;
const TOKEN = `e2e-invitation-${SUFFIXE.toLowerCase()}`;
let categorieId = "";
let invitationId = "";

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  categorieId = (
    await prisma.participantCategory.create({
      data: {
        editionId: edition.id,
        code: `E2E_COMITE_${SUFFIXE}`,
        labelFr: LIBELLE,
        labelEn: "E2E committee",
        isPublic: false,
      },
    })
  ).id;
  invitationId = (
    await prisma.invitation.create({
      data: {
        editionId: edition.id,
        email: EMAIL,
        firstName: "Awa",
        lastName: "Invitee",
        categoryId: categorieId,
        token: TOKEN,
        status: "SENT",
        sentAt: new Date(),
      },
    })
  ).id;
});

test.afterAll(async () => {
  await prisma.participant.deleteMany({ where: { email: EMAIL } });
  await prisma.invitation.deleteMany({ where: { id: invitationId } });
  await prisma.participantCategory.deleteMany({ where: { id: categorieId } });
  await prisma.$disconnect();
});

test("l'invité trouve sa catégorie préremplie et s'inscrit jusqu'au bout", async ({ page }) => {
  await page.goto(`/inscription?inv=${TOKEN}`);

  const categorie = page.getByLabel("Catégorie de participation");
  await expect(categorie).toHaveValue(LIBELLE);
  await expect(categorie).toHaveAttribute("readonly", "");
  await expect(
    page.getByText("Cette catégorie a été définie par le comité d'organisation."),
  ).toBeVisible();

  await page.getByLabel("Pays", { exact: true }).fill("Sénégal");
  await allerJusquAuBout(page);
  await accepterConsentements(page);
  await page.getByRole("button", { name: "Envoyer mon inscription" }).click();
  await expect(page.getByText("Inscription enregistrée")).toBeVisible({ timeout: 20_000 });

  const participant = await prisma.participant.findFirstOrThrow({ where: { email: EMAIL } });
  expect(participant.categoryId).toBe(categorieId);
  expect(participant.lastName).toBe("INVITEE");
  const invitation = await prisma.invitation.findUniqueOrThrow({ where: { id: invitationId } });
  expect(invitation.status).toBe("REGISTERED");
});
