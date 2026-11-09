import { expect, test, type Locator, type Page } from "@playwright/test";
import { prisma } from "../src/lib/db";

/**
 * Fiche détaillée d'un intervenant (5 novembre 2026).
 *
 * Les cartes de /intervenants et des pages de panel ne s'ouvraient pas : seul
 * un bouton, réservé aux biographies longues, menait au détail. Toute carte
 * ouvre désormais la fiche — par un clic sur la carte ou par son bouton
 * « Voir le profil » —, avec ou sans biographie. La carte ne montre qu'un
 * extrait d'une biographie longue ; la fiche la donne entière.
 */
const SUFFIXE = Date.now().toString(36).toUpperCase();
const AVEC_BIO = `BIOLONGUE${SUFFIXE}`;
const SANS_BIO = `SANSBIO${SUFFIXE}`;
const FIN_DE_BIO = "Elle préside depuis 2024 le comité scientifique du Forum.";
const BIO = `${"Statisticienne et démographe, elle a conduit les recensements de plusieurs pays d'Afrique de l'Ouest. ".repeat(12)}${FIN_DE_BIO}`;

const ids: { avecBio: string; sansBio: string } = { avecBio: "", sansBio: "" };
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
  for (const [cle, lastName, bioFr] of [
    ["avecBio", AVEC_BIO, BIO],
    ["sansBio", SANS_BIO, null],
  ] as const) {
    ids[cle] = (
      await prisma.speaker.create({
        data: {
          editionId: edition.id,
          firstName: "Awa",
          lastName,
          jobTitle: "Directrice des statistiques démographiques",
          organization: "ANSD",
          country: "Sénégal",
          bioFr,
          isPublished: true,
        },
      })
    ).id;
    await prisma.sessionSpeaker.create({
      data: { sessionId, speakerId: ids[cle], role: "PANELIST" },
    });
  }
});

test.afterAll(async () => {
  await prisma.speaker.deleteMany({ where: { id: { in: [ids.avecBio, ids.sansBio] } } });
  await prisma.session.deleteMany({ where: { id: sessionId } });
  await prisma.$disconnect();
});

const fiche = (page: Page, nom: string) => page.getByRole("dialog", { name: new RegExp(nom) });

const bouton = (carte: Locator) => carte.getByRole("button", { name: /Voir le profil de/ });

/** Ouvre la fiche par `ouvrir`, y vérifie le détail, puis la referme à la touche Échap. */
async function verifierFiche(page: Page, nom: string, ouvrir: () => Promise<void>) {
  await ouvrir();
  const fenetre = fiche(page, nom);
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByText("Directrice des statistiques démographiques")).toBeVisible();
  await expect(fenetre.getByText("ANSD · Sénégal")).toBeVisible();
  if (nom === AVEC_BIO) {
    await expect(fenetre.getByText(FIN_DE_BIO, { exact: false })).toBeVisible();
  } else {
    await expect(fenetre.getByText("Biographie à venir.")).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(fenetre).toBeHidden();
}

test("page Intervenants : la carte et son bouton ouvrent la fiche", async ({ page }) => {
  for (const nom of [AVEC_BIO, SANS_BIO]) {
    await page.goto(`/intervenants?q=${nom}`);
    const carte = page.locator(`#intervenant-${nom === AVEC_BIO ? ids.avecBio : ids.sansBio}`);
    // Un clic sur la carte, n'importe où.
    await verifierFiche(page, nom, () => carte.click());
    // Le bouton du verso, que le survol découvre.
    await carte.hover();
    await verifierFiche(page, nom, () => bouton(carte).click());
    // La carte ne montre qu'un extrait d'une biographie longue.
    await expect(carte.getByText(FIN_DE_BIO)).toHaveCount(0);
    // Le pays tient la place de « Cliquer pour le profil », en capitales.
    const pays = carte.locator(".face__indice--pays");
    await expect(pays).toHaveText("Sénégal");
    await expect(pays).toHaveCSS("text-transform", "uppercase");
  }
});

test("lien de l'accueil : la fiche visée s'ouvre d'elle-même", async ({ page }) => {
  await page.goto(`/intervenants#intervenant-${ids.sansBio}`);
  await expect(fiche(page, SANS_BIO)).toBeVisible();
});

test("fiche d'un panel : chaque carte s'ouvre, biographie ou non", async ({ page }) => {
  await page.goto(`/programme/${slug}`);
  for (const nom of [AVEC_BIO, SANS_BIO]) {
    const carte = page.locator("li").filter({ hasText: nom });
    await verifierFiche(page, nom, () => carte.getByText(nom).first().click());
    await verifierFiche(page, nom, () => bouton(carte).click());
    await expect(carte.getByText(FIN_DE_BIO)).toHaveCount(0);
    // Le pays, seul sur sa ligne juste avant « Voir le profil », en capitales.
    const pays = carte.getByText("Sénégal", { exact: true });
    await expect(pays).toBeVisible();
    await expect(pays).toHaveCSS("text-transform", "uppercase");
  }
});

test("page Intervenants : modérateurs d'abord, puis panélistes", async ({ page }) => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  // Le modérateur vient après le panéliste dans l'alphabet : seul son rôle le place devant.
  const panelisteNom = `ORDREA${SUFFIXE}`;
  const moderateurNom = `ORDREZ${SUFFIXE}`;
  const creer = (lastName: string) =>
    prisma.speaker.create({
      data: { editionId: edition.id, firstName: "Awa", lastName, isPublished: true },
    });
  const paneliste = await creer(panelisteNom);
  const moderateur = await creer(moderateurNom);
  await prisma.sessionSpeaker.createMany({
    data: [
      { sessionId, speakerId: paneliste.id, role: "PANELIST" },
      { sessionId, speakerId: moderateur.id, role: "MODERATOR" },
    ],
  });

  try {
    await page.goto(`/intervenants?q=ORDRE`);
    await expect(page.locator(".face__nom")).toHaveText([
      new RegExp(moderateurNom),
      new RegExp(panelisteNom),
    ]);
  } finally {
    await prisma.speaker.deleteMany({ where: { id: { in: [paneliste.id, moderateur.id] } } });
  }
});
