import { expect, test, type Page } from "@playwright/test";
import { prisma } from "../src/lib/db";

/**
 * Biographie longue d'un intervenant (5 novembre 2026) : la carte n'en montre
 * qu'un extrait, la fenêtre « Lire la biographie » la donne entière — sur la
 * page Intervenants (verso de la carte retournable) comme sur la fiche d'un
 * panel.
 */
const SUFFIXE = Date.now().toString(36).toUpperCase();
const NOM = `BIOLONGUE${SUFFIXE}`;
const FIN_DE_BIO = "Elle préside depuis 2024 le comité scientifique du Forum.";
const BIO = `${"Statisticienne et démographe, elle a conduit les recensements de plusieurs pays d'Afrique de l'Ouest. ".repeat(12)}${FIN_DE_BIO}`;

let speakerId = "";
let sessionId = "";
let slug = "";

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  slug = `panel-bio-${SUFFIXE.toLowerCase()}`;
  sessionId = (
    await prisma.session.create({
      data: {
        editionId: edition.id,
        slug,
        type: "PANEL",
        titleFr: `Panel biographie ${SUFFIXE}`,
        titleEn: `Biography panel ${SUFFIXE}`,
        day: edition.startDate,
        startTime: edition.startDate,
        endTime: new Date(edition.startDate.getTime() + 60 * 60 * 1000),
        isPublished: true,
      },
    })
  ).id;
  speakerId = (
    await prisma.speaker.create({
      data: {
        editionId: edition.id,
        firstName: "Awa",
        lastName: NOM,
        jobTitle: "Directrice des statistiques démographiques",
        organization: "ANSD",
        bioFr: BIO,
        isPublished: true,
      },
    })
  ).id;
  await prisma.sessionSpeaker.create({ data: { sessionId, speakerId, role: "PANELIST" } });
});

test.afterAll(async () => {
  await prisma.speaker.deleteMany({ where: { id: speakerId } });
  await prisma.session.deleteMany({ where: { id: sessionId } });
  await prisma.$disconnect();
});

/** Ouvre la fenêtre, y trouve la biographie entière, puis la referme à la touche Échap. */
async function lireLaBiographie(page: Page, depuis: ReturnType<Page["locator"]>) {
  // L'extrait seul est visible : la fin de la biographie n'y figure pas.
  await expect(depuis.getByText(FIN_DE_BIO)).toHaveCount(0);

  await depuis.getByRole("button", { name: /Lire la biographie de/ }).click();
  const fenetre = page.getByRole("dialog", { name: new RegExp(NOM) });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByText(FIN_DE_BIO, { exact: false })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(fenetre).toBeHidden();
}

test("page Intervenants : extrait au verso, biographie entière à la demande", async ({ page }) => {
  await page.goto(`/intervenants?q=${NOM}`);
  const carte = page.locator(`#intervenant-${speakerId}`);
  await carte.hover();
  await lireLaBiographie(page, carte);
});

test("fiche d'un panel : extrait, biographie entière à la demande", async ({ page }) => {
  await page.goto(`/programme/${slug}`);
  const carte = page.locator("li").filter({ hasText: NOM });
  await lireLaBiographie(page, carte);
});
