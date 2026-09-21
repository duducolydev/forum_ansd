import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Zones éditoriales, actualités et zones de dépôt (PLAN.md §26).
 *
 * Trois promesses faites au comité d'organisation, vérifiées de l'écran à la
 * page publique :
 *
 * 1. un texte éditorial se met en forme, et la mise en forme arrive intacte sur
 *    le site — tout de suite, pas dans une minute ;
 * 2. une actualité s'écrit avec le même éditeur ;
 * 3. un fichier **glissé** sur une zone de dépôt est pris en compte comme s'il
 *    avait été choisi dans le sélecteur du système.
 *
 * Le test travaille sur la zone « Visas », dont il rétablit le texte d'origine
 * à la fin, et sur sa propre actualité, supprimée avec elle.
 */

test.describe.configure({ mode: "serial", timeout: 240_000 });

const CLE = "practical.visa";
const SLUG = `e2e-actualite-${randomUUID().slice(0, 8)}`;

const PNG_1PX = [
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0,
  0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 252, 207, 192, 80, 15, 0, 4, 133,
  1, 128, 132, 169, 140, 33, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
];

/** Texte d'origine de la zone, relevé avant de l'écraser. */
let avant: { valueFr: unknown; valueEn: unknown } | null = null;

test.beforeAll(async () => {
  const bloc = await prisma.contentBlock.findFirst({ where: { key: CLE } });
  avant = bloc ? { valueFr: bloc.valueFr, valueEn: bloc.valueEn } : null;
});

test.afterAll(async () => {
  if (avant) {
    await prisma.contentBlock.updateMany({
      where: { key: CLE },
      data: { valueFr: avant.valueFr as string, valueEn: avant.valueEn as string },
    });
  }
  await prisma.post.deleteMany({ where: { slug: SLUG } });
  await prisma.$disconnect();
});

test("un texte éditorial mis en forme paraît sur le site, tout de suite", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/contenus");

  const bloc = page.locator(`[data-testid="bloc-contenu"][data-cle="${CLE}"]`);
  const editeur = bloc.getByRole("textbox", { name: "Français", exact: true });
  const outils = bloc.getByRole("toolbar", { name: /Infos pratiques — Visas — Français/ });

  await editeur.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Lettre d'invitation ");
  await outils.getByRole("button", { name: "Gras" }).click();
  await page.keyboard.type("officielle");
  await outils.getByRole("button", { name: "Gras" }).click();
  // Une balise tapée doit rester du texte, jusque sur le site.
  await page.keyboard.type(" <b>pas du gras</b>");

  await bloc.getByRole("button", { name: "Enregistrer" }).click();
  // L'écran confirme l'enregistrement : sans cette attente, la page publique
  // serait demandée avant que l'action n'ait écrit quoi que ce soit.
  await expect(bloc.getByText("Zone enregistrée.")).toBeVisible({ timeout: 20_000 });

  /*
   * Puis la page est demandée aussitôt, sans délai de complaisance : une
   * correction invisible pendant une minute passe pour perdue.
   */
  await page.goto("/infos-pratiques");
  const carte = page.locator("main").getByText("Lettre d'invitation");
  await expect(carte).toBeVisible();
  await expect(page.locator("main strong", { hasText: "officielle" })).toBeVisible();
  await expect(page.locator("main")).toContainText("<b>pas du gras</b>");
});

test("une actualité s'écrit avec le même éditeur et s'affiche mise en forme", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/contenus/actualites/nouvelle");

  await page.getByLabel("Titre (français)").fill("Actualité E2E mise en forme");
  await page.getByLabel("Slug (URL)").fill(SLUG);
  await page.getByLabel("Chapô (français)").fill("Chapô de l'actualité E2E.");

  const editeur = page.getByRole("textbox", { name: "Contenu (français)", exact: true });
  const outils = page.getByRole("toolbar", { name: "Mise en forme — Contenu (français)" });
  await editeur.click();
  await page.keyboard.type("Un paragraphe avec du ");
  await outils.getByRole("button", { name: "Gras" }).click();
  await page.keyboard.type("gras");
  await outils.getByRole("button", { name: "Gras" }).click();
  await outils.getByRole("button", { name: "Liste à puces" }).click();
  await page.keyboard.type("Premier point");

  await page.getByLabel("Publier immédiatement").check();
  await page.getByRole("button", { name: "Créer l'article" }).click();

  /*
   * L'article créé, l'action ramène à la liste (§26). Attendre l'URL
   * `/admin/contenus/actualites` **tout court** ne prouvait rien : celle de la
   * création commence par les mêmes mots, et un refus passait pour un succès.
   */
  await page.waitForURL(/\/admin\/contenus\/actualites$/, { timeout: 20_000 });
  await expect(page.getByText("Actualité E2E mise en forme")).toBeVisible();

  await page.goto(`/actualites/${SLUG}`);
  await expect(page.getByRole("heading", { name: "Actualité E2E mise en forme" })).toBeVisible();
  await expect(page.locator("main strong", { hasText: "gras" })).toBeVisible();
  await expect(page.locator("main li", { hasText: "Premier point" })).toBeVisible();
});

test("un fichier glissé sur une zone de dépôt est pris comme un fichier choisi", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/parametres/sections");

  // Le bandeau d'accueil existe toujours : sa zone d'illustration sert de cible.
  const carte = page.locator('[data-testid="carte-section"][data-type="hero"]').first();
  const zone = carte.locator("label", { has: page.locator('input[type="file"]') });

  const transfert = await page.evaluateHandle((octets) => {
    const donnees = new DataTransfer();
    donnees.items.add(new File([new Uint8Array(octets)], "glissee.png", { type: "image/png" }));
    return donnees;
  }, PNG_1PX);

  await zone.dispatchEvent("dragover", { dataTransfer: transfert });
  await zone.dispatchEvent("drop", { dataTransfer: transfert });

  // Le fichier est arrivé dans le champ, et l'écran l'annonce comme un choix.
  await expect(carte.getByText("glissee.png")).toBeVisible();
  await expect(carte.getByText(/Prête :/)).toBeVisible({ timeout: 30_000 });

  // Rien n'est enregistré : la section n'est pas soumise, la page est quittée.
  await page.goto("/admin");
});
