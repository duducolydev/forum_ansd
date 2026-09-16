import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";

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

test("génère les badges manquants du périmètre, puis n'en propose plus", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges?delegationId=${delegationId}`);

  await page.getByRole("button", { name: /Générer les 2 badges manquants/ }).click();
  await expect(page.getByText(/2 badge\(s\) mis en file/)).toBeVisible();

  // Le rendu se fait en arrière-plan : on attend les fichiers, pas le message.
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

test("la planche d'impression affiche un badge par page, au format carte", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/badges/planche?delegationId=${delegationId}`);

  await expect(page.getByText("2 badge(s) prêt(s) à imprimer")).toBeVisible();
  await expect(page.locator(".badge img")).toHaveCount(2);

  // Le format de page est réglé pour l'imprimante à badges.
  const styles = await page.locator("style").allTextContents();
  expect(styles.join("")).toContain("size: 85.6mm 54mm");
});

test("l'export reste fermé aux sessions sans permission", async ({ request }) => {
  expect((await request.get("/api/v1/badges/export")).status()).toBe(401);
});
