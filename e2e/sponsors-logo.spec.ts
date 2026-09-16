import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Dépôt du logo d'un partenaire (§5.9).
 *
 * Ce parcours existe parce qu'il a échoué en vrai : le logo de la Banque
 * mondiale, livré en SVG comme la plupart des logos institutionnels, était
 * refusé sans que l'agent comprenne pourquoi. Le SVG est désormais accepté,
 * sous condition — d'où les deux volets de ce test : le fichier légitime passe,
 * le fichier piégé est refusé, et la route ajoute ses en-têtes.
 */

const SVG_PROPRE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60">' +
  '<rect width="120" height="60" fill="#0b4f8a"/></svg>';

const SVG_PIEGE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">' +
  '<script>fetch("//ailleurs.example")</script></svg>';

let sponsorId: string;
let logoInitial: string | null;

test.beforeAll(async () => {
  const sponsor = await prisma.sponsor.findFirstOrThrow({
    where: { deletedAt: null, isPublished: true },
    select: { id: true, logoPath: true },
    orderBy: { name: "asc" },
  });
  sponsorId = sponsor.id;
  logoInitial = sponsor.logoPath;
});

test.afterAll(async () => {
  /*
   * L'état de départ est rendu : ce test s'exécute sur les données de
   * démonstration, pas sur des données à lui.
   *
   * Le fichier déposé est supprimé **avant** de remettre le chemin d'origine.
   * Le service efface l'ancien logo quand on le remplace, mais personne
   * n'efface le dernier : sans cette ligne, chaque exécution laissait un
   * orphelin dans le stockage. Sept s'étaient accumulés avant qu'on le voie.
   */
  const actuel = await prisma.sponsor.findUnique({
    where: { id: sponsorId },
    select: { logoPath: true },
  });
  if (actuel?.logoPath && actuel.logoPath !== logoInitial) {
    await fileStorage.delete(actuel.logoPath).catch(() => undefined);
  }

  await prisma.sponsor.update({ where: { id: sponsorId }, data: { logoPath: logoInitial } });
  await prisma.$disconnect();
});

test("choisir un fichier suffit : l'envoi part sans second clic", async ({ page }) => {
  /*
   * Le défaut fermé ici a été rapporté en usage réel. La fiche porte deux
   * formulaires côte à côte ; choisir le logo puis cliquer sur « Enregistrer »
   * — le bouton visible en bas de la fiche — soumettait celui du sponsor et
   * laissait le fichier sur place. L'écran répondait « Sponsor enregistré », le
   * logo n'était jamais parti, et le champ se vidait au rafraîchissement.
   *
   * Ce test n'appuie volontairement sur **aucun** bouton après le choix du
   * fichier : si l'envoi automatique disparaissait, il échouerait aussitôt.
   */
  await seConnecterAdmin(page);
  await page.goto(`/admin/sponsors/${sponsorId}`);

  await page.locator('input[name="logo"]').setInputFiles({
    name: "logo BM.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });

  await expect(page.getByText("Logo enregistré.")).toBeVisible();
  await expect(page.getByAltText(/^Logo de /)).toBeVisible();

  const enBase = await prisma.sponsor.findUniqueOrThrow({
    where: { id: sponsorId },
    select: { logoPath: true },
  });
  expect(enBase.logoPath).not.toBeNull();
});

test("un SVG piégé est refusé, et la raison est affichée", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sponsors/${sponsorId}`);

  await page.locator('input[name="logo"]').setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(SVG_PIEGE),
  });
  await page.getByRole("button", { name: /Téléverser/ }).click();

  await expect(page.getByText(/SVG refusé : script/)).toBeVisible();
});

test("un SVG propre est accepté, affiché, et servi durci", async ({ page, request }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sponsors/${sponsorId}`);

  await page.locator('input[name="logo"]').setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(SVG_PROPRE),
  });
  await page.getByRole("button", { name: /Téléverser/ }).click();

  await expect(page.getByText("Logo enregistré.")).toBeVisible();

  const enBase = await prisma.sponsor.findUniqueOrThrow({
    where: { id: sponsorId },
    select: { logoPath: true },
  });
  expect(enBase.logoPath).toMatch(/\.svg$/);

  /*
   * En-têtes de durcissement. Un SVG chargé par `<img>` n'exécute rien, mais
   * cette URL peut aussi être ouverte directement : elle devient alors un
   * document, et c'est ce cas que la CSP et le `nosniff` ferment.
   */
  const reponse = await request.get(`/api/v1/sponsors/${sponsorId}/logo`);
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()["content-type"]).toContain("image/svg+xml");
  expect(reponse.headers()["x-content-type-options"]).toBe("nosniff");
  expect(reponse.headers()["content-security-policy"]).toContain("default-src 'none'");
  expect(reponse.headers()["content-security-policy"]).toContain("sandbox");

  // Et le logo apparaît bien sur la page publique, à la place du nom.
  await page.goto("/sponsors");
  await expect(page.locator(`img[src*="${sponsorId}"]`)).toBeVisible();
});
