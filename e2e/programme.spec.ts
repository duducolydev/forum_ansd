import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";
import { confirmerBoite } from "./helpers/dialogue";

/**
 * Programme et sessions (brief §5.5, §5.8, PLAN.md 4.4).
 *
 * Le test crée sa propre session par l'écran d'administration : c'est le
 * parcours réel du comité scientifique, et il éprouve du même coup le
 * brouillon, la publication et la fiche publique.
 */
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();
const TITRE = `Panel E2E ${SUFFIXE}`;
const JOUR = "2026-11-24";

let editionId = "";
let salleId = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  editionId = edition.id;
  salleId = (
    await prisma.room.create({
      data: { editionId, name: `Salle E2E ${SUFFIXE}`, capacity: 42 },
    })
  ).id;
});

test.afterAll(async () => {
  await prisma.session.deleteMany({ where: { titleFr: { contains: SUFFIXE } } });
  await prisma.room.deleteMany({ where: { id: salleId } });
  await prisma.$disconnect();
});

/**
 * Une carte de session, distinguée par son URL. Les motifs évitent la ponctuation
 * (tirets cadratins, apostrophes) : elle est encodée en entités HTML dans le rendu,
 * et un test qui s'y accroche casse au premier changement de typographie.
 *
 * `.first()` sur les présences : la grille rend chaque carte deux fois, une
 * fois pour les écrans larges et une fois pour la liste étroite, dont une
 * seule est visible. Les absences, elles, se vérifient bien sur les deux : les pastilles de filtre
 * portent le même libellé (« Conférence inaugurale » est à la fois un type et
 * un titre) et pointent vers `/programme?...`, pas vers `/programme/<slug>`.
 */
const carte = (page: import("@playwright/test").Page, motif: RegExp) =>
  page.locator('a[href^="/programme/"]').filter({ hasText: motif });

test("la grille publique affiche les journées et se filtre par salle", async ({ page }) => {
  await page.goto("/programme");

  await expect(page.getByRole("heading", { name: "Programme" })).toBeVisible();
  await expect(page.getByRole("link", { name: /lundi 23 novembre/ })).toBeVisible();
  await expect(carte(page, /Recensements et registres/).first()).toBeVisible();

  // Filtrer sur une salle qui n'accueille pas ce panel doit l'écarter.
  await page.getByRole("link", { name: "Salle plénière", exact: true }).click();
  await expect(carte(page, /Recensements et registres/)).toHaveCount(0);
  await expect(carte(page, /politiques publiques/).first()).toBeVisible();
});

test("une session créée en brouillon reste invisible du public, puis paraît une fois publiée", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/sessions/nouvelle");

  await page.getByLabel("Titre (français) *").fill(TITRE);
  await page.getByLabel("Jour *").fill(JOUR);
  await page.getByLabel("Début *").fill("15:00");
  await page.getByLabel("Fin *").fill("16:00");
  await page.getByLabel("Salle").selectOption({ label: `Salle E2E ${SUFFIXE} (42)` });
  await page.getByLabel("Capacité").fill("42");
  // Réservation ouverte : c'est ce qui fait apparaître le compteur de places
  // sur la fiche publique, et le formulaire exige alors une capacité.
  await page.getByLabel("Réservation ouverte").check();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Session enregistrée.")).toBeVisible();

  const creee = await prisma.session.findFirstOrThrow({ where: { titleFr: TITRE } });
  expect(creee.isPublished).toBe(false);
  // Le slug est dérivé du titre quand on n'en fournit pas.
  expect(creee.slug).toContain("panel-e2e");

  // Brouillon : 404 pour le public, et non 403 — annoncer « interdit »
  // révélerait qu'un panel se prépare sous ce nom.
  const brouillon = await page.request.get(`/programme/${creee.slug}`);
  expect(brouillon.status()).toBe(404);

  await page.goto("/admin/sessions");
  const ligne = page.getByRole("row", { name: new RegExp(SUFFIXE) });
  await ligne.getByRole("button", { name: "Publier" }).click();
  await expect(ligne.getByRole("button", { name: "Dépublier" })).toBeVisible();

  await page.goto(`/programme/${creee.slug}`);
  await expect(page.getByRole("heading", { name: TITRE })).toBeVisible();
  await expect(page.getByText(/0 \/ 42 inscrits/)).toBeVisible();
  await expect(page.getByText("Ouvert", { exact: false }).first()).toBeVisible();
});

test("la duplication repart en brouillon, réservation fermée", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/sessions");

  const ligne = page.getByRole("row", { name: new RegExp(`${SUFFIXE}(?!.*copie)`) }).first();
  await ligne.getByRole("button", { name: "Dupliquer" }).click();
  await expect(page.getByText(`${TITRE} (copie)`)).toBeVisible();

  const copie = await prisma.session.findFirstOrThrow({
    where: { titleFr: `${TITRE} (copie)` },
  });
  // Dupliquer un panel pour en préparer un autre ne doit pas mettre en ligne,
  // à la seconde, une session dont le titre est encore celui de l'original.
  expect(copie.isPublished).toBe(false);
  expect(copie.registrationOpen).toBe(false);
  expect(copie.slug).not.toBe("");
});

test("refuse de supprimer une session qui porte des inscriptions", async ({ page }) => {
  const session = await prisma.session.findFirstOrThrow({ where: { titleFr: TITRE } });
  const participant = await prisma.participant.findFirstOrThrow({
    where: { editionId, email: { startsWith: "demo." } },
  });
  await prisma.sessionRegistration.create({
    data: { sessionId: session.id, participantId: participant.id },
  });

  await seConnecterAdmin(page);
  await page.goto("/admin/sessions");

  const ligne = page.getByRole("row", { name: new RegExp(`${SUFFIXE}(?!.*copie)`) }).first();
  await ligne.getByRole("button", { name: "Supprimer" }).click();
  await confirmerBoite(page);

  await expect(ligne).toContainText(/inscription\(s\)/);
  const toujoursLa = await prisma.session.findUnique({ where: { id: session.id } });
  expect(toujoursLa?.deletedAt).toBeNull();

  await prisma.sessionRegistration.deleteMany({ where: { sessionId: session.id } });
});
