import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import { SPEAKER_SESSION_COOKIE, signSpeakerSession } from "../src/modules/speakers/session";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Intervenant rattaché à une session **après** son dépôt (PLAN.md §15.9).
 *
 * Le défaut signalé : un intervenant créé en BackOffice, sans session, dépose sa
 * présentation — et elle n'apparaît nulle part. Aucun écran ne permettait de le
 * rattacher à une session ; seul le jeu de démonstration le faisait. Ce parcours
 * rejoue exactement ce cas, jusqu'au retrait.
 */

test.describe.configure({ mode: "serial", timeout: 240_000 });

const SUFFIXE = randomUUID().slice(0, 8);
const NOM = `Tardif${SUFFIXE}`;

let speakerId = "";
let session = { id: "", titleFr: "" };
let contributionId = "";
let cheminContribution = "";

async function connecterIntervenant(context: BrowserContext, id: string): Promise<void> {
  await context.addCookies([
    {
      name: SPEAKER_SESSION_COOKIE,
      value: await signSpeakerSession(id),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** PDF minimal mais authentique : la détection porte sur les octets. */
function pdfDe(octets: number): Buffer {
  const entete = Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n", "latin1");
  const fin = Buffer.from("\n%%EOF\n", "latin1");
  const corps = Buffer.alloc(Math.max(0, octets - entete.length - fin.length), 0x20);
  return Buffer.concat([entete, corps, fin]);
}

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });

  // Quatrième session publiée : les trois premières servent aux parcours
  // Contributions et Rapporteurs.
  const choisie = await prisma.session.findFirstOrThrow({
    where: { editionId: edition.id, isPublished: true, deletedAt: null },
    orderBy: { startTime: "asc" },
    skip: 3,
    select: { id: true, titleFr: true },
  });
  session = choisie;

  speakerId = (
    await prisma.speaker.create({
      data: {
        editionId: edition.id,
        email: `e2e-tardif-${SUFFIXE}@example.test`,
        firstName: "Seynabou",
        lastName: NOM,
      },
    })
  ).id;
});

test.afterAll(async () => {
  const contributions = await prisma.contribution.findMany({
    where: { speakerId },
    select: { id: true, filePath: true },
  });
  for (const { filePath } of contributions) {
    if (filePath) await fileStorage.delete(filePath).catch(() => undefined);
  }
  await prisma.contribution.deleteMany({ where: { speakerId } });

  const fichiers = await prisma.speaker.findUnique({
    where: { id: speakerId },
    select: { photoPath: true, presentationPath: true },
  });
  for (const chemin of [fichiers?.photoPath, fichiers?.presentationPath]) {
    if (chemin) await fileStorage.delete(chemin).catch(() => undefined);
  }
  await prisma.speaker.deleteMany({ where: { id: speakerId } });
  await prisma.$disconnect();
});

test("sans session, le dépôt le dit, et le gestionnaire le voit en attente", async ({
  page,
  context,
}) => {
  await connecterIntervenant(context, speakerId);
  await page.goto("/espace-intervenant");

  await page.locator('input[name="presentation"]').setInputFiles({
    name: "support.pdf",
    mimeType: "application/pdf",
    buffer: pdfDe(32 * 1024),
  });
  // Le message dit où va le fichier — c'est-à-dire, ici, nulle part encore.
  await expect(page.getByText(/Aucune session ne vous est encore attribuée/)).toBeVisible({
    timeout: 60_000,
  });

  const enBase = await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId } });
  expect(enBase.presentationPath).not.toBeNull();
  expect(await prisma.contribution.count({ where: { speakerId } })).toBe(0);

  await seConnecterAdmin(page);
  await page.goto("/admin/contributions");
  const attente = page.getByTestId("presentation-en-attente").filter({ hasText: NOM });
  await expect(attente).toBeVisible();

  await attente.getByRole("link", { name: "Rattacher à une session" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/intervenants/${speakerId}/modifier$`));
});

test("rattaché ensuite, sa présentation rejoint la session en brouillon", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/intervenants/${speakerId}/modifier`);

  const panneau = page.getByRole("region", { name: "Sessions de l'intervenant" });
  await expect(panneau.getByText(/ne figure dans aucune contribution/)).toBeVisible();

  await panneau.getByLabel("Session à ajouter").selectOption(session.id);
  await panneau.getByLabel("Rôle dans la session").selectOption("PANELIST");
  await panneau.getByRole("button", { name: "Ajouter à la session" }).click();
  await expect(
    panneau.getByText(/Sa présentation a rejoint les contributions de la session/),
  ).toBeVisible();

  const lien = await prisma.sessionSpeaker.findUniqueOrThrow({
    where: { sessionId_speakerId: { sessionId: session.id, speakerId } },
  });
  expect(lien.role).toBe("PANELIST");
  expect(lien.confirmationStatus).toBe("PRESSENTI");

  const contribution = await prisma.contribution.findFirstOrThrow({
    where: { sessionId: session.id, speakerId, origine: "INTERVENANT" },
  });
  expect(contribution.isPublished).toBe(false);
  expect(contribution.filePath).not.toBeNull();
  contributionId = contribution.id;
  cheminContribution = contribution.filePath!;

  await page.goto(`/admin/sessions/${session.id}/contributions`);
  const carte = page.locator(`[data-testid="carte-contribution"][data-id="${contributionId}"]`);
  await expect(carte.getByText("Déposée par l'intervenant")).toBeVisible();

  // Plus en attente : il a une session.
  await page.goto("/admin/contributions");
  await expect(page.getByTestId("presentation-en-attente").filter({ hasText: NOM })).toHaveCount(0);
});

test("le statut de confirmation s'enregistre au changement, et l'intervenant le voit", async ({
  page,
  context,
}) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/intervenants/${speakerId}/modifier`);

  const panneau = page.getByRole("region", { name: "Sessions de l'intervenant" });
  await panneau.getByLabel(`Statut — ${session.titleFr}`).selectOption("CONFIRME");
  await expect(panneau.getByText("Rattachement mis à jour.")).toBeVisible();

  const lien = await prisma.sessionSpeaker.findUniqueOrThrow({
    where: { sessionId_speakerId: { sessionId: session.id, speakerId } },
  });
  expect(lien.confirmationStatus).toBe("CONFIRME");

  await connecterIntervenant(context, speakerId);
  await page.goto("/espace-intervenant");
  const interventions = page.getByRole("listitem").filter({ hasText: session.titleFr });
  await expect(interventions).toContainText("Confirmé");
});

test("retiré de la session, sa présentation en brouillon en sort aussi", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/intervenants/${speakerId}/modifier`);

  const panneau = page.getByRole("region", { name: "Sessions de l'intervenant" });
  await panneau
    .getByTestId("rattachement-session")
    .filter({ hasText: session.titleFr })
    .getByRole("button", { name: "Retirer" })
    .click();
  await page.locator(".swal2-confirm").click();

  await expect(panneau.getByText(/retiré de la session, avec sa présentation/)).toBeVisible();
  expect(await prisma.sessionSpeaker.count({ where: { sessionId: session.id, speakerId } })).toBe(
    0,
  );
  expect(await prisma.contribution.count({ where: { id: contributionId } })).toBe(0);
  // Et son fichier avec elle : pas d'orphelin sur le disque.
  await expect(fileStorage.get(cheminContribution)).rejects.toThrow();
});
