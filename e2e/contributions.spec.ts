import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Contributions & Actes (brief §5.10, lot 3).
 *
 * Le parcours va de bout en bout : saisir une contribution en BackOffice,
 * déposer un document, publier, et la retrouver sur la fiche publique de la
 * session puis sur la page d'index.
 */

test.describe.configure({ timeout: 240_000 });

let sessionId: string;
let sessionSlug: string;
const creees: string[] = [];

test.beforeAll(async () => {
  const session = await prisma.session.findFirstOrThrow({
    where: { isPublished: true },
    orderBy: { startTime: "asc" },
    select: { id: true, slug: true },
  });
  sessionId = session.id;
  sessionSlug = session.slug;
});

test.afterAll(async () => {
  /*
   * Seules les contributions créées ici sont retirées : le test ne touche pas à
   * ce qu'un agent aurait saisi par ailleurs.
   *
   * Leurs fichiers d'abord. Supprimer les lignes seules laissait sur le disque
   * le PDF de 4 Mo du test de dépôt, à chaque exécution : deux orphelins
   * s'étaient accumulés avant qu'on le voie. C'est le défaut déjà corrigé sur le
   * test des logos de partenaires, reproduit ici par inattention.
   */
  if (creees.length > 0) {
    const fichiers = await prisma.contribution.findMany({
      where: { id: { in: creees }, filePath: { not: null } },
      select: { filePath: true },
    });
    for (const { filePath } of fichiers) {
      if (filePath) await fileStorage.delete(filePath).catch(() => undefined);
    }
    await prisma.contribution.deleteMany({ where: { id: { in: creees } } });
  }
  await prisma.$disconnect();
});

/**
 * Ouvre le panneau « Ajouter une contribution ».
 *
 * Il est replié à chaque chargement : sans ce geste, les champs sont présents
 * dans le DOM mais invisibles, et Playwright refuse — à juste titre — de les
 * remplir.
 */
async function ouvrirAjout(page: import("@playwright/test").Page) {
  const ajout = page.locator("details");
  await ajout.locator("summary").click();
  await expect(ajout.getByLabel("Titre")).toBeVisible();
  return ajout;
}

/** PDF minimal mais authentique : la détection porte sur les octets. */
function pdfDe(octets: number): Buffer {
  const entete = Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1");
  const fin = Buffer.from("\n%%EOF\n", "latin1");
  const corps = Buffer.alloc(Math.max(0, octets - entete.length - fin.length), 0x20);
  return Buffer.concat([entete, corps, fin]);
}

test("une synthèse saisie et publiée apparaît sur la fiche de session", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionId}/contributions`);

  const ajout = await ouvrirAjout(page);
  await ajout.getByLabel("Type").selectOption("SYNTHESIS");
  await ajout.getByLabel("Titre").fill("Synthèse des échanges");
  await ajout.getByLabel("Texte").fill("Les participants ont convenu de trois priorités.");
  await ajout.getByLabel("Publier sur le site").check();
  await ajout.getByRole("button", { name: "Ajouter" }).click();

  await expect(page.getByText("Contribution ajoutée.")).toBeVisible();

  const enBase = await prisma.contribution.findFirstOrThrow({
    where: { sessionId, title: "Synthèse des échanges" },
  });
  creees.push(enBase.id);
  expect(enBase.isPublished).toBe(true);

  await page.goto(`/programme/${sessionSlug}`);
  await expect(page.getByRole("heading", { name: "Synthèse des échanges" })).toBeVisible();
  await expect(page.getByText("trois priorités")).toBeVisible();

  await page.goto("/contributions");
  await expect(page.getByRole("link", { name: /Synthèse|Lire la session/ }).first()).toBeVisible();
});

test("un lien vidéo non reconnu est refusé, un lien YouTube est accepté", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionId}/contributions`);

  const ajout = await ouvrirAjout(page);
  await ajout.getByLabel("Type").selectOption("VIDEO");
  await ajout.getByLabel("Titre").fill("Rediffusion");
  await ajout.getByLabel("Lien vidéo").fill("https://exemple.test/video/1");
  await ajout.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText(/Lien vidéo non reconnu/)).toBeVisible();

  /*
   * Ce que l'agent a choisi et tapé survit au refus — **type compris**.
   *
   * React 19 remet un `<form action>` à zéro après chaque action, refus
   * compris. Le titre effacé se voyait ; le type, non : la liste revenait à son
   * option par défaut dans la page pendant que l'état React gardait « Vidéo ».
   * L'écran montrait toujours le champ lien, et le second envoi partait avec un
   * autre type — refusé par « ce type de contribution n'accepte pas de lien ».
   * C'est cette assertion qui l'a révélé.
   */
  await expect(ajout.getByLabel("Titre")).toHaveValue("Rediffusion");
  await expect(ajout.getByLabel("Type")).toHaveValue("VIDEO");

  await ajout.getByLabel("Lien vidéo").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await ajout.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Contribution ajoutée.")).toBeVisible();

  const enBase = await prisma.contribution.findFirstOrThrow({
    where: { sessionId, title: "Rediffusion" },
  });
  creees.push(enBase.id);
});

test("un document de plus de 3 Mo est déposé, ce qu'une Server Action ne permettrait pas", async ({
  page,
  request,
}) => {
  /*
   * Le cœur du sujet. Le brief autorise 50 Mo ; les Server Actions s'arrêtent à
   * 3 Mo et rejettent au-delà sans message (§13.7). Le dépôt passe donc par une
   * route, et ce test le prouve avec un fichier au-dessus du plafond.
   */
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionId}/contributions`);

  const ajout = await ouvrirAjout(page);
  await ajout.getByLabel("Type").selectOption("PRESENTATION");
  await ajout.getByLabel("Titre").fill("Support du panel");
  await ajout.getByLabel("Publier sur le site").check();
  await ajout.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Contribution ajoutée.")).toBeVisible();

  const enBase = await prisma.contribution.findFirstOrThrow({
    where: { sessionId, title: "Support du panel" },
  });
  creees.push(enBase.id);

  const carte = page.locator(`[data-testid="carte-contribution"][data-id="${enBase.id}"]`);
  const gros = pdfDe(4 * 1024 * 1024);
  expect(gros.length).toBeGreaterThan(3 * 1024 * 1024);

  await carte.locator('input[type="file"]').setInputFiles({
    name: "support.pdf",
    mimeType: "application/pdf",
    buffer: gros,
  });
  await expect(carte.getByText("Fichier déposé.")).toBeVisible({ timeout: 60_000 });

  const apres = await prisma.contribution.findUniqueOrThrow({ where: { id: enBase.id } });
  expect(apres.filePath, "le fichier doit être enregistré").not.toBeNull();

  // Servi en téléchargement, pas rendu comme un document du site.
  const reponse = await request.get(`/api/v1/contributions/${enBase.id}/fichier`);
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()["content-type"]).toContain("application/pdf");
  expect(reponse.headers()["content-disposition"]).toContain("attachment");
  expect(reponse.headers()["x-content-type-options"]).toBe("nosniff");
});

test("un fichier qui n'est ni PDF ni PPTX est refusé, avec sa raison", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionId}/contributions`);

  const carte = page.locator('[data-testid="carte-contribution"][data-type="PRESENTATION"]').last();
  await carte.locator('input[type="file"]').setInputFiles({
    name: "piege.pdf",
    mimeType: "application/pdf",
    // Un exécutable renommé : le contrôle porte sur les octets.
    buffer: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(512, 0)]),
  });

  await expect(carte.getByText(/PDF et PPTX sont acceptés/)).toBeVisible({ timeout: 30_000 });
});

test("une contribution non publiée n'est pas devinable depuis le site", async ({
  page,
  request,
}) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionId}/contributions`);

  const ajout = await ouvrirAjout(page);
  await ajout.getByLabel("Type").selectOption("DOCUMENT");
  await ajout.getByLabel("Titre").fill("Note interne du comité");
  await ajout.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Contribution ajoutée.")).toBeVisible();

  const enBase = await prisma.contribution.findFirstOrThrow({
    where: { sessionId, title: "Note interne du comité" },
  });
  creees.push(enBase.id);
  expect(enBase.isPublished).toBe(false);

  await page.goto(`/programme/${sessionSlug}`);
  await expect(page.getByText("Note interne du comité")).toHaveCount(0);

  /*
   * Et son fichier reste inaccessible en tirant l'URL. La fixture `request` ne
   * partage pas les cookies de la page connectée : elle joue donc exactement le
   * visiteur anonyme.
   */
  const reponse = await request.get(`/api/v1/contributions/${enBase.id}/fichier`);
  expect(reponse.status()).toBe(404);
});
