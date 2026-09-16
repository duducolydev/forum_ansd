import { randomUUID } from "node:crypto";
import argon2 from "argon2";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import { SPEAKER_SESSION_COOKIE, signSpeakerSession } from "../src/modules/speakers/session";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Rapporteurs et dépôts des intervenants (PLAN.md §15).
 *
 * La décision : les rapporteurs rédigent sur les sessions auxquelles ils sont
 * rattachés, les présentations déposées par les intervenants rejoignent les
 * contributions, et **seul le gestionnaire programme publie** — avec l'accord
 * de l'intervenant quand c'est son support.
 *
 * Deux des refus sont éprouvés en **forgeant** le formulaire : masquer une case
 * ne protège rien, c'est le serveur qui doit dire non.
 */

test.describe.configure({ mode: "serial", timeout: 240_000 });

const RAPPORTEUR = {
  email: "e2e.rapporteur@example.test",
  password: "E2E!Rapporteur-2026",
  nom: "Rapporteur E2E",
} as const;

const SUFFIXE = randomUUID().slice(0, 8);
const TITRE_SYNTHESE = `Synthèse du rapporteur ${SUFFIXE}`;

let rapporteurId = "";
let sessionConfiee = { id: "", titleFr: "" };
let sessionAutre = { id: "", titleFr: "" };
let speakerId = "";
let contributionAutreId = "";
let presentationId = "";
const creees: string[] = [];

/** Compte rapporteur dédié aux tests, remis en état à chaque exécution. */
async function assurerRapporteur(): Promise<string> {
  const role = await prisma.role.findFirstOrThrow({ where: { name: "RAPPORTEUR" } });
  const passwordHash = await argon2.hash(RAPPORTEUR.password, { type: argon2.argon2id });
  const donnees = {
    passwordHash,
    roleId: role.id,
    isActive: true,
    failedAttempts: 0,
    lockedUntil: null,
  };
  const compte = await prisma.user.upsert({
    where: { email: RAPPORTEUR.email },
    update: donnees,
    create: { ...donnees, email: RAPPORTEUR.email, name: RAPPORTEUR.nom },
  });
  return compte.id;
}

async function seConnecterRapporteur(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(RAPPORTEUR.email);
  await page.getByLabel("Mot de passe").fill(RAPPORTEUR.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/admin/, { timeout: 15_000 });
}

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

async function ouvrirAjout(page: Page) {
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

function carte(page: Page, id: string) {
  return page.locator(`[data-testid="carte-contribution"][data-id="${id}"]`);
}

test.beforeAll(async () => {
  rapporteurId = await assurerRapporteur();
  // Un rattachement laissé par une exécution interrompue fausserait le premier test.
  await prisma.sessionRapporteur.deleteMany({ where: { userId: rapporteurId } });

  /*
   * Deuxième et troisième sessions publiées : la première sert au test des
   * contributions, et les deux fichiers ne doivent pas se marcher dessus.
   */
  const sessions = await prisma.session.findMany({
    where: { isPublished: true },
    orderBy: { startTime: "asc" },
    take: 3,
    select: { id: true, titleFr: true, editionId: true },
  });
  expect(sessions.length, "le jeu de données doit compter trois sessions publiées").toBe(3);
  sessionConfiee = sessions[1]!;
  sessionAutre = sessions[2]!;

  const speaker = await prisma.speaker.create({
    data: {
      editionId: sessions[1]!.editionId,
      email: `e2e-rapport-speaker-${SUFFIXE}@example.test`,
      firstName: "Ndeye",
      lastName: `Oratrice${SUFFIXE}`,
      sessions: { create: { sessionId: sessionConfiee.id, role: "PANELIST" } },
    },
  });
  speakerId = speaker.id;

  const autre = await prisma.contribution.create({
    data: {
      editionId: sessions[2]!.editionId,
      sessionId: sessionAutre.id,
      type: "DOCUMENT",
      title: `Document hors périmètre ${SUFFIXE}`,
    },
  });
  contributionAutreId = autre.id;
  creees.push(autre.id);
});

test.afterAll(async () => {
  const contributions = await prisma.contribution.findMany({
    where: { OR: [{ id: { in: creees } }, { speakerId }] },
    select: { id: true, filePath: true },
  });
  for (const { filePath } of contributions) {
    if (filePath) await fileStorage.delete(filePath).catch(() => undefined);
  }
  await prisma.contribution.deleteMany({
    where: { id: { in: contributions.map((contribution) => contribution.id) } },
  });

  const speaker = await prisma.speaker.findUnique({
    where: { id: speakerId },
    select: { presentationPath: true },
  });
  if (speaker?.presentationPath) {
    await fileStorage.delete(speaker.presentationPath).catch(() => undefined);
  }
  await prisma.speaker.deleteMany({ where: { id: speakerId } });

  // Le compte reste, comme celui de l'administrateur E2E ; ses rattachements non.
  await prisma.sessionRapporteur.deleteMany({ where: { userId: rapporteurId } });
  await prisma.$disconnect();
});

test("le gestionnaire rattache un rapporteur à une session", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionConfiee.id}/contributions`);

  const panneau = page.getByRole("region", { name: "Rapporteurs de la session" });
  await panneau.getByLabel("Rattacher un rapporteur").selectOption(rapporteurId);
  await panneau.getByRole("button", { name: "Rattacher" }).click();

  await expect(panneau.getByText("Rapporteur rattaché.")).toBeVisible();
  await expect(panneau.getByText(RAPPORTEUR.email)).toBeVisible();
  expect(
    await prisma.sessionRapporteur.count({
      where: { sessionId: sessionConfiee.id, userId: rapporteurId },
    }),
  ).toBe(1);
});

test("le rapporteur ne voit que sa session, et y rédige sans publier", async ({ page }) => {
  await seConnecterRapporteur(page);

  // Pas de tableau de bord pour lui : la connexion le conduit à ses sessions.
  await expect(page).toHaveURL(/\/admin\/contributions$/);
  const sessions = page.getByTestId("session-contributions");
  await expect(sessions).toHaveCount(1);
  await expect(sessions.first()).toContainText(sessionConfiee.titleFr);
  await expect(page.getByRole("link", { name: "Participants" })).toHaveCount(0);

  await sessions.first().getByRole("link").click();
  await expect(page.getByRole("heading", { name: sessionConfiee.titleFr })).toBeVisible();

  const ajout = await ouvrirAjout(page);
  await expect(ajout.getByLabel("Publier sur le site")).toHaveCount(0);
  await ajout.getByLabel("Type").selectOption("SYNTHESIS");
  await ajout.getByLabel("Titre").fill(TITRE_SYNTHESE);
  await ajout.getByLabel("Texte").fill("Trois recommandations ont été retenues.");
  await ajout.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText("Contribution ajoutée.")).toBeVisible();

  const enBase = await prisma.contribution.findFirstOrThrow({
    where: { sessionId: sessionConfiee.id, title: TITRE_SYNTHESE },
  });
  creees.push(enBase.id);
  expect(enBase.origine).toBe("RAPPORTEUR");
  expect(enBase.isPublished).toBe(false);

  /*
   * Formulaire forgé : on y glisse la case « Publier » que l'écran ne montre
   * pas au rapporteur. Le serveur doit refuser, et dire pourquoi.
   */
  const sienne = carte(page, enBase.id);
  await sienne.locator("form").evaluate((formulaire) => {
    const champ = document.createElement("input");
    champ.type = "hidden";
    champ.name = "isPublished";
    champ.value = "on";
    formulaire.appendChild(champ);
  });
  await sienne.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    sienne.getByText("Seul le gestionnaire programme publie les contributions."),
  ).toBeVisible();
  expect(
    (await prisma.contribution.findUniqueOrThrow({ where: { id: enBase.id } })).isPublished,
  ).toBe(false);

  // Une session qui ne lui est pas confiée : refusée, avec la raison.
  await page.goto(`/admin/sessions/${sessionAutre.id}/contributions`);
  await expect(page.getByText("Cette session ne vous est pas confiée.")).toBeVisible();
  await expect(page.getByTestId("carte-contribution")).toHaveCount(0);

  // Et la route de dépôt refuse de même, pour qui l'appellerait directement.
  const depot = await page.request.post(`/api/v1/contributions/${contributionAutreId}/fichier`, {
    headers: { "Content-Type": "application/octet-stream" },
    data: pdfDe(2048),
  });
  expect(depot.status()).toBe(403);
});

test("une présentation de plus de 3 Mo rejoint la session de l'intervenant, en brouillon", async ({
  page,
  context,
}) => {
  await connecterIntervenant(context, speakerId);
  await page.goto("/espace-intervenant");

  const gros = pdfDe(4 * 1024 * 1024);
  expect(gros.length).toBeGreaterThan(3 * 1024 * 1024);

  await page.locator('input[name="presentation"]').setInputFiles({
    name: "support-panel.pdf",
    mimeType: "application/pdf",
    buffer: gros,
  });
  await expect(page.getByText("Présentation enregistrée.")).toBeVisible({ timeout: 60_000 });

  const liee = await prisma.contribution.findFirstOrThrow({
    where: { sessionId: sessionConfiee.id, speakerId, origine: "INTERVENANT" },
  });
  presentationId = liee.id;
  expect(liee.type).toBe("PRESENTATION");
  expect(liee.isPublished).toBe(false);
  expect(liee.filePath).not.toBeNull();
});

test("le rapporteur ne retouche pas la présentation de l'intervenant", async ({ page }) => {
  await seConnecterRapporteur(page);
  await page.goto(`/admin/sessions/${sessionConfiee.id}/contributions`);

  const presentation = carte(page, presentationId);
  await expect(
    presentation.getByText(/déposée par l'intervenant : elle ne se modifie pas/),
  ).toBeVisible();
  await expect(presentation.getByRole("button", { name: "Enregistrer" })).toHaveCount(0);
  await expect(presentation.getByRole("button", { name: "Supprimer" })).toHaveCount(0);
});

test("sans l'accord de l'intervenant, le gestionnaire ne peut pas publier sa présentation", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionConfiee.id}/contributions`);

  const presentation = carte(page, presentationId);
  await expect(presentation.getByText("Accord de l'intervenant manquant")).toBeVisible();
  const publier = presentation.getByLabel("Publier sur le site");
  await expect(publier).toBeDisabled();

  // Case réactivée et cochée à la main : c'est le serveur qui doit refuser.
  await publier.evaluate((element) => {
    const caseACocher = element as HTMLInputElement;
    caseACocher.disabled = false;
    caseACocher.checked = true;
  });
  await presentation.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    presentation.getByText("L'intervenant n'a pas autorisé la publication de sa présentation."),
  ).toBeVisible();
  expect(
    (await prisma.contribution.findUniqueOrThrow({ where: { id: presentationId } })).isPublished,
  ).toBe(false);
});

test("avec son accord, le gestionnaire publie ; un nouveau fichier la retire du site", async ({
  page,
  context,
  request,
}) => {
  await connecterIntervenant(context, speakerId);
  await page.goto("/espace-intervenant");
  await page
    .getByLabel("J'autorise la publication de ma présentation sur le site du Forum")
    .check();
  await expect(page.getByText(/Publication autorisée\. Le comité/)).toBeVisible();

  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionConfiee.id}/contributions`);
  const presentation = carte(page, presentationId);
  await expect(presentation.getByText("Publication autorisée", { exact: true })).toBeVisible();
  await presentation.getByLabel("Publier sur le site").check();
  await presentation.getByRole("button", { name: "Enregistrer" }).click();
  await expect(presentation.getByText("Contribution enregistrée.")).toBeVisible();

  const publiee = await prisma.contribution.findUniqueOrThrow({ where: { id: presentationId } });
  expect(publiee.isPublished).toBe(true);
  // `request` ne porte aucun cookie : c'est le visiteur anonyme.
  expect((await request.get(`/api/v1/contributions/${presentationId}/fichier`)).status()).toBe(200);

  /*
   * L'intervenant remplace son support : le comité a validé l'ancien, pas
   * celui-ci. La contribution repasse en brouillon, et l'URL ne répond plus.
   */
  await page.goto("/espace-intervenant");
  await page.locator('input[name="presentation"]').setInputFiles({
    name: "support-v2.pdf",
    mimeType: "application/pdf",
    buffer: pdfDe(64 * 1024),
  });
  await expect(page.getByText("Présentation enregistrée.")).toBeVisible({ timeout: 60_000 });

  const remplacee = await prisma.contribution.findUniqueOrThrow({ where: { id: presentationId } });
  expect(remplacee.isPublished).toBe(false);
  expect(remplacee.filePath).not.toBe(publiee.filePath);
  expect((await request.get(`/api/v1/contributions/${presentationId}/fichier`)).status()).toBe(404);
});

test("retirer son accord retire la présentation du site", async ({ page, context }) => {
  // Remise en ligne directe : ce test porte sur le retrait, pas sur la publication.
  await prisma.contribution.update({ where: { id: presentationId }, data: { isPublished: true } });

  await connecterIntervenant(context, speakerId);
  await page.goto("/espace-intervenant");
  const accord = page.getByLabel(
    "J'autorise la publication de ma présentation sur le site du Forum",
  );
  await expect(accord).toBeChecked();
  await accord.uncheck();
  await expect(page.getByText(/Autorisation retirée/)).toBeVisible();

  const apres = await prisma.contribution.findUniqueOrThrow({ where: { id: presentationId } });
  expect(apres.isPublished).toBe(false);
  expect(
    (await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId } })).presentationConsentement,
  ).toBe(false);
});
