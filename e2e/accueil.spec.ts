import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Comptoir d'accueil (brief §5.7, PLAN.md 4.7).
 *
 * Le test suit le geste réel de l'agent : taper trois lettres, choisir dans la
 * liste, presser un bouton. Ce qui est vérifié derrière — badge émis, présence
 * enregistrée, statut avancé — est ce qui doit être vrai à la fin des
 * 90 secondes visées.
 */
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();

let editionId = "";
let categoryId = "";
let zoneId = "";
let checkpointId = "";
let inviteId = "";
const emails: string[] = [];

/**
 * Le formulaire de création, et non la page entière : le champ de recherche
 * porte un libellé qui cite « nom », « téléphone » et « organisation », donc
 * chaque `getByLabel` global y trouverait deux cibles.
 */
const formulaire = (page: import("@playwright/test").Page) => page.locator("form");

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  editionId = edition.id;
  categoryId = (
    await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    })
  ).id;

  const zone = await prisma.zone.create({
    data: { editionId, code: `ZACC${SUFFIXE}`, name: `Zone accueil ${SUFFIXE}` },
  });
  zoneId = zone.id;
  await prisma.categoryZone.create({ data: { categoryId, zoneId } });
  checkpointId = (
    await prisma.checkpoint.create({
      data: { editionId, zoneId, name: `Comptoir ${SUFFIXE}` },
    })
  ).id;

  const email = `e2e-accueil-${randomUUID()}@example.test`;
  emails.push(email);
  inviteId = (
    await prisma.participant.create({
      data: {
        editionId,
        publicId: `ACC-${SUFFIXE}-1`,
        firstName: "Awa",
        lastName: `Invitee${SUFFIXE}`,
        email,
        country: "Sénégal",
        organization: "ANSD",
        categoryId,
        status: "REGISTERED",
        source: "ONLINE",
      },
    })
  ).id;
});

test.afterAll(async () => {
  await prisma.scanLog.deleteMany({ where: { checkpointId } });
  await prisma.checkpoint.deleteMany({ where: { id: checkpointId } });
  const crees = await prisma.participant.findMany({
    where: { editionId, lastName: { contains: SUFFIXE } },
    select: { id: true },
  });
  await prisma.participant.deleteMany({
    where: { OR: [{ email: { in: emails } }, { id: { in: crees.map((p) => p.id) } }] },
  });
  await prisma.zone.deleteMany({ where: { id: zoneId } });
  await prisma.$disconnect();
});

test("la caméra est autorisée sur le comptoir, et nulle part ailleurs dans le BackOffice", async ({
  page,
}) => {
  await seConnecterAdmin(page);

  const accueil = await page.goto("/admin/accueil");
  expect(accueil?.headers()["permissions-policy"]).toContain("camera=(self)");

  const participants = await page.goto("/admin/participants");
  expect(participants?.headers()["permissions-policy"]).toContain("camera=()");
});

test("retrouve un inscrit, le valide, le badge et enregistre son passage", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/accueil");

  await page
    .getByLabel("Point de contrôle")
    .selectOption({ label: `Comptoir ${SUFFIXE} — ZACC${SUFFIXE}` });
  await page.getByLabel(/Nom, e-mail, téléphone/).fill(`Invitee${SUFFIXE}`);

  const ligne = page.getByRole("listitem").filter({ hasText: `Invitee${SUFFIXE}` });
  await expect(ligne).toContainText("Inscrit, à valider");
  await ligne.getByRole("button", { name: "Valider et badger" }).click();

  await expect(page.getByText(/Badge généré · présence enregistrée/)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("link", { name: "Imprimer le badge" })).toBeVisible();

  const recharge = await prisma.participant.findUniqueOrThrow({ where: { id: inviteId } });
  expect(recharge.status).toBe("CHECKED_IN");
  expect(await prisma.badge.count({ where: { participantId: inviteId } })).toBe(1);
  expect(await prisma.scanLog.count({ where: { checkpointId, participantId: inviteId } })).toBe(1);
});

test("inscrit une personne inconnue et la fait entrer dans la foulée", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/accueil");

  await page
    .getByLabel("Point de contrôle")
    .selectOption({ label: `Comptoir ${SUFFIXE} — ZACC${SUFFIXE}` });
  await page.getByRole("button", { name: "Nouvelle inscription" }).click();

  const creation = formulaire(page);
  await creation.getByLabel("Prénom *").fill("Moussa");
  await creation.getByLabel("Nom *", { exact: true }).fill(`Nouveau${SUFFIXE}`);
  await creation.getByLabel("Téléphone").fill("+221770000000");
  await creation.getByLabel("Organisation").fill("Le Soleil");
  await page.getByRole("button", { name: /Inscrire, badger/ }).click();

  await expect(page.getByText(/présence enregistrée/)).toBeVisible({ timeout: 60_000 });

  const cree = await prisma.participant.findFirstOrThrow({
    where: { editionId, lastName: `Nouveau${SUFFIXE}` },
  });
  // Inscription au comptoir : validée d'emblée, et tracée comme telle.
  expect(cree.status).toBe("CHECKED_IN");
  expect(cree.source).toBe("ONSITE");
  expect(await prisma.badge.count({ where: { participantId: cree.id } })).toBe(1);
});

test("exige au moins un e-mail ou un téléphone", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/accueil");

  await page.getByRole("button", { name: "Nouvelle inscription" }).click();
  await formulaire(page).getByLabel("Prénom *").fill("Sans");
  await formulaire(page).getByLabel("Nom *", { exact: true }).fill(`Contact${SUFFIXE}`);
  await page.getByRole("button", { name: /Inscrire, badger/ }).click();

  await expect(page.getByText(/au moins une adresse e-mail ou un numéro/)).toBeVisible();
  expect(
    await prisma.participant.count({ where: { editionId, lastName: `Contact${SUFFIXE}` } }),
  ).toBe(0);
});

test("refuse un doublon d'adresse et renvoie vers la recherche", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/accueil");

  await page.getByRole("button", { name: "Nouvelle inscription" }).click();
  const doublon = formulaire(page);
  await doublon.getByLabel("Prénom *").fill("Doublon");
  await doublon.getByLabel("Nom *", { exact: true }).fill(`Doublon${SUFFIXE}`);
  await doublon.getByLabel("E-mail").fill(emails[0]!);
  await page.getByRole("button", { name: /Inscrire, badger/ }).click();

  await expect(page.getByText(/déjà inscrite\. Recherchez-la/)).toBeVisible();
});
