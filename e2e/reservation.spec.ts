import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import {
  PARTICIPANT_SESSION_COOKIE,
  signParticipantSession,
} from "../src/modules/auth/participant-session";
import { prisma } from "../src/lib/db";
import { seConnecterAdmin } from "./helpers/comptes";
import { confirmerBoite } from "./helpers/dialogue";

/**
 * Réservation des panels (brief §5.5, PLAN.md 4.5).
 *
 * Le parcours participant passe par le **vrai lien magique** : c'est le seul
 * chemin qui ouvre une session « Mon espace », et donc la seule façon
 * d'éprouver la route de réservation telle qu'elle sera appelée.
 */
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();

let editionId = "";
let categoryId = "";
let sessionId = "";
let sessionSlug = "";
const emails: string[] = [];
const participants: { id: string; email: string; publicId: string }[] = [];

async function creerParticipant(index: number) {
  const email = `e2e-resa-${randomUUID()}@example.test`;
  emails.push(email);
  const participant = await prisma.participant.create({
    data: {
      editionId,
      publicId: `RE2E-${SUFFIXE}-${index}`,
      firstName: "Aminata",
      lastName: `Sow${index}`,
      email,
      country: "Sénégal",
      organization: "ANSD",
      categoryId,
      status: "CONFIRMED",
      source: "ONSITE",
      confirmedAt: new Date(),
    },
  });
  participants.push({ id: participant.id, email, publicId: participant.publicId });
  return participant;
}

/**
 * Ouvre une session « Mon espace » en posant le **vrai cookie de session
 * participant**, signé avec le même secret que l'application.
 *
 * Le lien magique complet n'est pas rejouable ici : la base ne conserve que
 * l'empreinte du jeton, jamais le jeton lui-même — c'est précisément ce qui
 * fait sa valeur. On emprunte donc le mécanisme de session, qui est ce que le
 * lien produit, pour éprouver la réservation telle qu'un participant l'appelle.
 */
async function connecterParticipant(context: BrowserContext, participantId: string) {
  const jeton = await signParticipantSession(participantId);
  await context.addCookies([
    {
      name: PARTICIPANT_SESSION_COOKIE,
      value: jeton,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  editionId = edition.id;
  categoryId = (
    await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    })
  ).id;

  const session = await prisma.session.create({
    data: {
      editionId,
      slug: `resa-e2e-${SUFFIXE.toLowerCase()}`,
      type: "PANEL",
      titleFr: `Panel réservation ${SUFFIXE}`,
      titleEn: "Booking panel",
      day: new Date("2026-11-25T00:00:00.000Z"),
      startTime: new Date("2026-11-25T09:00:00.000Z"),
      endTime: new Date("2026-11-25T10:00:00.000Z"),
      capacity: 1,
      registrationOpen: true,
      waitlistEnabled: true,
      isPublished: true,
    },
  });
  sessionId = session.id;
  sessionSlug = session.slug;

  await creerParticipant(1);
  await creerParticipant(2);
});

test.afterAll(async () => {
  await prisma.sessionRegistration.deleteMany({ where: { sessionId } });
  await prisma.session.deleteMany({ where: { id: sessionId } });
  await prisma.participant.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

test("la fiche publique invite à se connecter avant de réserver", async ({ page }) => {
  await page.goto(`/programme/${sessionSlug}`);
  await expect(page.getByText(/0 \/ 1 inscrits/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Connectez-vous/ })).toBeVisible();
});

test("la route de réservation refuse un appel sans session participant", async ({ request }) => {
  const reponse = await request.post(`/api/v1/sessions/${sessionId}/register`);
  expect(reponse.status()).toBe(401);
});

test("le comité place deux participants : le premier inscrit, le second en attente", async ({
  page,
}) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionId}/inscriptions`);

  const champ = page.getByLabel(/Inscrire un participant/);
  await champ.fill(participants[0]!.publicId);
  await page.getByRole("button", { name: "Inscrire", exact: true }).click();
  await expect(page.getByText("Participant inscrit.")).toBeVisible();

  await champ.fill(participants[1]!.publicId);
  await page.getByRole("button", { name: "Inscrire", exact: true }).click();
  await expect(page.getByText(/liste d'attente \(position 1\)/)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("row", { name: new RegExp(participants[0]!.publicId) }),
  ).toContainText("Inscrit");
  await expect(
    page.getByRole("row", { name: new RegExp(participants[1]!.publicId) }),
  ).toContainText("Liste d'attente");
});

test("retirer l'inscrit promeut automatiquement la personne en attente", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto(`/admin/sessions/${sessionId}/inscriptions`);

  const ligne = page.getByRole("row", { name: new RegExp(participants[0]!.publicId) });
  await ligne.getByRole("button", { name: "Retirer" }).click();
  await confirmerBoite(page);

  await expect(page.getByText(/promue et prévenue/)).toBeVisible();

  const promu = await prisma.sessionRegistration.findFirstOrThrow({
    where: { sessionId, participantId: participants[1]!.id },
  });
  expect(promu.status).toBe("REGISTERED");
  expect(promu.promotedAt).not.toBeNull();
});

test("un participant connecté réserve puis annule depuis la fiche publique", async ({
  page,
  context,
}) => {
  const libre = await prisma.session.create({
    data: {
      editionId,
      slug: `resa-libre-${SUFFIXE.toLowerCase()}`,
      type: "PANEL",
      titleFr: `Panel libre ${SUFFIXE}`,
      titleEn: "Free panel",
      day: new Date("2026-11-25T00:00:00.000Z"),
      startTime: new Date("2026-11-25T14:00:00.000Z"),
      endTime: new Date("2026-11-25T15:00:00.000Z"),
      capacity: 5,
      registrationOpen: true,
      waitlistEnabled: true,
      isPublished: true,
    },
  });

  await connecterParticipant(context, participants[0]!.id);
  await page.goto(`/programme/${libre.slug}`);

  await page.getByRole("button", { name: "Réserver ma place" }).click();
  await expect(page.getByText("Votre place est réservée.")).toBeVisible();

  const inscription = await prisma.sessionRegistration.findFirstOrThrow({
    where: { sessionId: libre.id, participantId: participants[0]!.id },
  });
  expect(inscription.status).toBe("REGISTERED");

  await page.reload();
  await expect(page.getByText("1 / 5 inscrits")).toBeVisible();

  await page.getByRole("button", { name: "Annuler ma réservation" }).click();
  await expect(page.getByText("Votre réservation est annulée.")).toBeVisible();

  await prisma.sessionRegistration.deleteMany({ where: { sessionId: libre.id } });
  await prisma.session.deleteMany({ where: { id: libre.id } });
});

test("exporte les inscrits en CSV et la feuille d'émargement en PDF", async ({ page }) => {
  await seConnecterAdmin(page);

  const csv = await page.request.get(`/api/v1/sessions/${sessionId}/registrations?format=csv`);
  expect(csv.status()).toBe(200);
  const texte = await csv.text();
  // BOM UTF-8 en tête : sans lui, Excel massacre les accents.
  expect(texte.charCodeAt(0)).toBe(0xfeff);
  expect(texte).toContain(participants[1]!.publicId);
  // L'annulé ne doit pas figurer sur une feuille qu'on va faire signer.
  expect(texte).not.toContain(participants[0]!.publicId);

  const pdf = await page.request.get(`/api/v1/sessions/${sessionId}/registrations?format=pdf`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
});
