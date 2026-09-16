import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Sections : fond sombre, position de l'illustration, texte mis en forme
 * (PLAN.md §17).
 *
 * Le parcours passe par l'écran, de la barre d'outils jusqu'à la page publique :
 * c'est là que se voient les défauts qui comptent — une mise en forme perdue à
 * l'enregistrement, une balise tapée qui deviendrait du HTML, une image restée
 * à droite.
 *
 * Il travaille sur **sa propre section**, supprimée à la fin avec son fichier.
 */

test.describe.configure({ mode: "serial", timeout: 240_000 });

const ANCRE = `e2e-mise-en-forme-${randomUUID().slice(0, 8)}`;
let sectionId = "";
/*
 * Chemin de l'illustration, retenu dès l'enregistrement : si la suppression par
 * l'écran efface la ligne mais pas le fichier, la base ne mène plus à rien et
 * le nettoyage final doit pouvoir l'effacer quand même.
 */
let illustration = "";

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.afterAll(async () => {
  if (sectionId) {
    const section = await prisma.pageSection.findUnique({ where: { id: sectionId } });
    const image = (section?.settings as Record<string, unknown> | null)?.image;
    for (const chemin of new Set([illustration, typeof image === "string" ? image : ""])) {
      if (chemin) await fileStorage.delete(chemin).catch(() => undefined);
    }
    await prisma.pageSection.deleteMany({ where: { id: sectionId } });
  }
  await prisma.$disconnect();
});

test("un bloc de texte mis en forme, sur fond sombre, avec l'illustration à gauche", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/parametres/sections");

  await page.getByLabel("Type").selectOption("texte");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(/Section ajoutée/)).toBeVisible();

  const carte = page.locator('[data-testid="carte-section"][data-type="texte"]').last();
  sectionId = (await carte.getAttribute("data-id")) ?? "";
  expect(sectionId).not.toBe("");

  await carte.getByLabel("Présentation").selectOption("sombre");
  await carte.getByLabel("Titre (facultatif) (français)").fill("Mise en forme E2E");

  // Mise en forme par la barre d'outils et par les raccourcis clavier.
  const outils = carte.getByRole("toolbar", { name: "Mise en forme — Texte (français)" });
  const editeur = carte.getByRole("textbox", { name: "Texte (français)", exact: true });
  await editeur.click();
  await page.keyboard.type("Début ");
  await outils.getByRole("button", { name: "Gras" }).click();
  await page.keyboard.type("gras");
  await outils.getByRole("button", { name: "Gras" }).click();
  await page.keyboard.type(" puis ");
  await page.keyboard.press("Control+i");
  await page.keyboard.type("italique");
  await page.keyboard.press("Control+i");
  await page.keyboard.type(" et ");
  await outils.getByRole("button", { name: "Souligné" }).click();
  await page.keyboard.type("souligné");
  await outils.getByRole("button", { name: "Souligné" }).click();
  await outils.getByRole("button", { name: "Saut de ligne" }).click();
  await page.keyboard.type("Nouvelle ligne");
  // Une balise tapée doit rester du texte, jusque sur le site.
  await page.keyboard.press("Enter");
  await page.keyboard.type("<b>pas du gras</b>");

  await carte.getByLabel("Ancre (lien direct)").fill(ANCRE);
  await carte.getByLabel("À gauche du texte").check();
  await carte.getByLabel("Afficher sur le site").check();
  await carte.locator('input[type="file"]').setInputFiles({
    name: "illustration.png",
    mimeType: "image/png",
    buffer: PNG_1PX,
  });
  await expect(carte.getByText(/Prête :/)).toBeVisible({ timeout: 30_000 });

  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("Section enregistrée.")).toBeVisible();

  // En base : un document structuré, pas de HTML.
  const enBase = await prisma.pageSection.findUniqueOrThrow({ where: { id: sectionId } });
  const corps = (enBase.contentFr as Record<string, string>).corps ?? "";
  expect(corps.startsWith('{"type":"doc"')).toBe(true);
  expect(enBase.variant).toBe("sombre");
  expect((enBase.settings as Record<string, unknown>).positionImage).toBe("gauche");
  illustration = String((enBase.settings as Record<string, unknown>).image ?? "");
  expect(illustration, "l'illustration doit avoir été enregistrée").not.toBe("");

  // Sur le site.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/#${ANCRE}`);
  const section = page.locator(`section#${ANCRE}`);
  await expect(section).toBeVisible();

  await expect(section).toHaveAttribute("data-theme", "dark");
  const fond = await section.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(fond, "fond sombre de la marque en thème clair").toBe("rgb(8, 44, 78)");

  await expect(section.locator("strong")).toHaveText("gras");
  await expect(section.locator("em")).toHaveText("italique");
  await expect(section.locator("u")).toHaveText("souligné");
  await expect(section.locator("br")).toHaveCount(1);
  await expect(section.getByText("<b>pas du gras</b>")).toBeVisible();
  await expect(section.locator("b")).toHaveCount(0);

  const image = section.locator("img");
  await expect(image).toBeVisible();
  const boiteImage = await image.boundingBox();
  const boiteTexte = await section.locator("p").first().boundingBox();
  expect(boiteImage!.x, "l'illustration doit être à gauche du texte").toBeLessThan(boiteTexte!.x);
});

test("la mise en forme, le fond et la position sont retrouvés à la réouverture", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/parametres/sections");

  const carte = page.locator(`[data-testid="carte-section"][data-id="${sectionId}"]`);
  const editeur = carte.getByRole("textbox", { name: "Texte (français)", exact: true });

  await expect(editeur.locator("strong")).toHaveText("gras");
  await expect(editeur.locator("em")).toHaveText("italique");
  await expect(editeur.locator("u")).toHaveText("souligné");
  await expect(carte.getByLabel("Présentation")).toHaveValue("sombre");
  await expect(carte.getByLabel("À gauche du texte")).toBeChecked();
});

test("supprimer la section depuis le BackOffice efface aussi son illustration", async ({
  page,
}) => {
  /*
   * Défaut trouvé en contrôlant le stockage : la suppression effaçait la ligne
   * et laissait l'image sur le disque, sans plus rien pour y mener. La
   * suppression passe ici par le bouton, comme un agent, et non par la base.
   */
  const image = illustration;
  expect(image, "la section doit porter une illustration").not.toBe("");
  await expect(fileStorage.get(image)).resolves.toBeTruthy();

  await seConnecterAdmin(page);
  await page.goto("/admin/parametres/sections");
  const carte = page.locator(`[data-testid="carte-section"][data-id="${sectionId}"]`);
  await carte.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page.locator(".swal2-confirm").click();
  await expect(carte).toHaveCount(0);

  expect(await prisma.pageSection.count({ where: { id: sectionId } })).toBe(0);
  await expect(fileStorage.get(image)).rejects.toThrow();
});
