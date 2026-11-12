import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";
import { cliquerPuisConfirmer } from "./helpers/dialogue";

const executer = promisify(execFile);

/**
 * Impression de badges en masse (brief §5.4, PLAN.md 4.8).
 *
 * L'archive est **réellement extraite** par l'outil du système, et non
 * seulement relue par le code qui l'a écrite : une archive que nous serions
 * seuls à savoir lire ne servirait à rien le jour où l'ANSD la reçoit.
 */
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();

let editionId = "";
let categoryId = "";
let delegationId = "";
const emails: string[] = [];
const participantIds: string[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  editionId = edition.id;
  categoryId = (
    await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    })
  ).id;
  delegationId = (
    await prisma.delegation.create({
      data: { editionId, name: `Délégation E2E ${SUFFIXE}`, country: "Mali" },
    })
  ).id;

  for (const nom of ["Sow", "Ba"]) {
    const email = `e2e-masse-${randomUUID()}@example.test`;
    emails.push(email);
    const participant = await prisma.participant.create({
      data: {
        editionId,
        publicId: `MAS-${SUFFIXE}-${emails.length}`,
        firstName: "Aminata",
        lastName: `${nom}${SUFFIXE}`,
        email,
        country: "Mali",
        organization: "INSTAT",
        categoryId,
        delegationId,
        status: "CONFIRMED",
        source: "ONSITE",
        confirmedAt: new Date(),
      },
    });
    participantIds.push(participant.id);
  }
});

test.afterAll(async () => {
  await prisma.badge.deleteMany({ where: { participantId: { in: participantIds } } });
  await prisma.participant.deleteMany({ where: { id: { in: participantIds } } });
  await prisma.delegation.deleteMany({ where: { id: delegationId } });
  await prisma.$disconnect();
});

test("l'écran filtre par délégation et annonce ce qui reste à générer", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges?delegationId=${delegationId}`);

  await expect(page.getByRole("heading", { name: "Badges" })).toBeVisible();
  await expect(page.getByText("2 participant(s) · 2 sans badge")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(`Sow${SUFFIXE}`, "i") })).toContainText(
    "À générer",
  );
});

/**
 * Le geste courant : **filtrer, puis cocher** quelques lignes à l'intérieur du
 * filtre (12 novembre 2026). Les deux se combinent — la case restreint ce que
 * le filtre a désigné, elle ne le remplace pas.
 */
test("génère la seule ligne cochée du filtre, puis le reste du filtre", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges?delegationId=${delegationId}`);

  // Aucune case cochée : le bouton porte sur tout le périmètre du filtre.
  await expect(page.getByText(/Les actions portent sur 2 participants du filtre/)).toBeVisible();

  // Une seule case cochée : le périmètre se resserre sur elle, dans ce filtre.
  await page
    .getByRole("row", { name: new RegExp(`Sow${SUFFIXE}`, "i") })
    .getByRole("checkbox")
    .check();
  await expect(page.getByText(/Les actions portent sur 1 ligne cochée/)).toBeVisible();
  await page.getByRole("button", { name: "Générer 1 badge(s) manquant(s)" }).click();
  await expect(page.getByText(/1 badge\(s\) mis en file/)).toBeVisible();

  // Le rendu se fait en arrière-plan : on attend les fichiers, pas le message.
  await expect
    .poll(async () => prisma.badge.count({ where: { participantId: participantIds[0] } }), {
      timeout: 90_000,
      message: "le badge de la ligne cochée n'a pas été créé",
    })
    .toBe(1);
  // L'autre personne du filtre n'a rien reçu : la case a bien restreint.
  expect(await prisma.badge.count({ where: { participantId: participantIds[1] } })).toBe(0);

  // Sans case cochée, le même bouton reprend tout le filtre — ici le reste.
  await page.goto(`/admin/badges?delegationId=${delegationId}`);
  await page.getByRole("button", { name: "Générer 1 badge(s) manquant(s)" }).click();
  await expect(page.getByText(/1 badge\(s\) mis en file/)).toBeVisible();

  await expect
    .poll(
      async () =>
        prisma.badge.count({
          where: { participantId: { in: participantIds }, pdfPath: { not: null } },
        }),
      { timeout: 90_000, message: "les badges n'ont pas été rendus" },
    )
    .toBe(2);
});

test("l'archive ZIP s'extrait vraiment, rangée par délégation", async ({ page }) => {
  await seConnecterAdmin(page);

  const reponse = await page.request.get(`/api/v1/badges/export?delegationId=${delegationId}`);
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()["content-type"]).toContain("application/zip");
  // Le nombre de manquants voyage en en-tête : l'utilisateur doit l'apprendre
  // sans ouvrir l'archive.
  expect(reponse.headers()["x-badges-inclus"]).toBe("2");
  expect(reponse.headers()["x-badges-manquants"]).toBe("0");

  const dossier = await mkdtemp(join(tmpdir(), "badges-zip-"));
  try {
    const archive = join(dossier, "badges.zip");
    await writeFile(archive, await reponse.body());

    // Extraction par l'outil du système, seul juge valable.
    const extrait = join(dossier, "extrait");
    await executer("powershell.exe", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${archive}' -DestinationPath '${extrait}' -Force`,
    ]);

    /*
     * Les noms reviennent encodés en base64 : la sortie console de PowerShell
     * est en page de code locale, et les accents y arrivent mutilés alors
     * qu'ils sont corrects sur le disque. Le détour évite de faire échouer le
     * test sur un artefact d'affichage.
     */
    const { stdout } = await executer("powershell.exe", [
      "-NoProfile",
      "-Command",
      `$noms = Get-ChildItem -Recurse -File -LiteralPath '${extrait}' | ForEach-Object { $_.FullName.Substring(${extrait.length + 1}) }; ` +
        `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($noms -join "\`n"))`,
    ]);

    const fichiers = Buffer.from(stdout.trim(), "base64")
      .toString("utf8")
      .split(/\r?\n/)
      .filter(Boolean);

    expect(fichiers).toHaveLength(2);
    // Un dossier par délégation : c'est ainsi que les paquets sont distribués,
    // et les accents doivent y survivre.
    for (const fichier of fichiers) {
      expect(fichier).toContain(`Délégation E2E ${SUFFIXE}`);
      expect(fichier.endsWith(".pdf")).toBe(true);
    }
  } finally {
    await rm(dossier, { recursive: true, force: true });
  }
});

test("la planche d'impression affiche un badge par page, au format du badge", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges/planche?delegationId=${delegationId}`);

  await expect(page.getByText("2 badge(s) prêt(s) à imprimer")).toBeVisible();
  await expect(page.locator(".badge img")).toHaveCount(2);

  // Le format de page est celui du badge, en portrait (25 octobre 2026).
  const styles = await page.locator("style").allTextContents();
  expect(styles.join("")).toContain("size: 100mm 150mm");
});

/**
 * Les actions de masse se règlent sur une **sélection** à l'intérieur du
 * filtre (12 novembre 2026). Ce test refait un badge déjà émis, ce qui ne
 * change ni le QR ni le fichier attendu par les tests précédents.
 */
test("cocher une ligne restreint l'action à celle-là", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges?delegationId=${delegationId}`);

  const ligneSow = page.getByRole("row", { name: new RegExp(`Sow${SUFFIXE}`, "i") });
  await ligneSow.getByRole("checkbox").check();

  // Le périmètre et les compteurs suivent la case cochée.
  await expect(page.getByText(/Les actions portent sur 1 ligne cochée/)).toBeVisible();
  await cliquerPuisConfirmer(page, { nom: "Refaire 1 badge(s) déjà émis" });

  await expect(page.getByText(/1 badge\(s\) remis en file/)).toBeVisible();
});

/**
 * Révocation groupée (12 novembre 2026).
 *
 * Placée après l'export et la planche : elle invalide pour de bon les badges
 * du périmètre, que les tests précédents comptent encore.
 */
test("révoque les badges cochés, et seulement ceux-là", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges?delegationId=${delegationId}`);

  const ligneSow = page.getByRole("row", { name: new RegExp(`Sow${SUFFIXE}`, "i") });
  await ligneSow.getByRole("checkbox").check();

  await page.getByRole("button", { name: "Révoquer 1 badge(s)…" }).click();

  // Sans motif, le bouton reste inerte : la trace d'audit doit dire pourquoi.
  const bouton = page.getByRole("button", { name: "Révoquer 1 badge(s)", exact: true });
  await expect(bouton).toBeDisabled();

  await page.getByLabel(/Motif de révocation/).fill("Badge perdu (E2E)");
  await cliquerPuisConfirmer(page, bouton);

  await expect(page.getByText("1 badge(s) révoqué(s).")).toBeVisible();
  await expect(ligneSow).toContainText("Révoqué");

  const revoques = await prisma.badge.findMany({
    where: { participantId: { in: participantIds }, revokedAt: { not: null } },
    select: { participantId: true, revokeReason: true },
  });
  expect(revoques).toEqual([
    { participantId: participantIds[0], revokeReason: "Badge perdu (E2E)" },
  ]);
});

test("révoque tout le périmètre du filtre quand aucune case n'est cochée", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges?delegationId=${delegationId}`);

  // Un seul badge encore valide dans la délégation : celui que le test
  // précédent a laissé. Le compteur du bouton le dit sans qu'on coche rien.
  await page.getByRole("button", { name: "Révoquer 1 badge(s)…" }).click();
  await page.getByLabel(/Motif de révocation/).fill("Délégation annulée (E2E)");
  await cliquerPuisConfirmer(
    page,
    // Locator exact : « Révoquer 1 badge(s)… », le bouton qui déplie le motif,
    // contient ce libellé et serait sinon ambigu.
    page.getByRole("button", { name: "Révoquer 1 badge(s)", exact: true }),
  );

  await expect(page.getByText("1 badge(s) révoqué(s).")).toBeVisible();

  const revoques = await prisma.badge.count({
    where: { participantId: { in: participantIds }, revokedAt: { not: null } },
  });
  expect(revoques).toBe(2);
});

/**
 * La sortie de secours d'une révocation (12 novembre 2026) : les deux badges
 * de la délégation viennent d'être révoqués, et ces personnes doivent pouvoir
 * en recevoir un valide sans qu'on reprenne leur fiche une par une.
 */
test("réémet les badges révoqués du filtre, en version suivante", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges?delegationId=${delegationId}`);

  // Rien à générer : un badge révoqué se réémet, il ne se régénère pas.
  await expect(
    page.getByRole("button", { name: /Générer 0 badge\(s\) manquant\(s\)/ }),
  ).toBeDisabled();
  await cliquerPuisConfirmer(page, { nom: "Réémettre 2 badge(s) révoqué(s)" });

  await expect(page.getByText(/2 badge\(s\) réémis en version suivante/)).toBeVisible();

  // Chacun a une v2 valide, et sa v1 reste révoquée.
  await expect
    .poll(
      async () =>
        prisma.badge.count({
          where: { participantId: { in: participantIds }, version: 2, revokedAt: null },
        }),
      { timeout: 30_000, message: "les versions 2 n'ont pas été créées" },
    )
    .toBe(2);
  expect(
    await prisma.badge.count({
      where: { participantId: { in: participantIds }, version: 1, revokedAt: { not: null } },
    }),
  ).toBe(2);
});

test("l'export reste fermé aux sessions sans permission", async ({ request }) => {
  expect((await request.get("/api/v1/badges/export")).status()).toBe(401);
});
