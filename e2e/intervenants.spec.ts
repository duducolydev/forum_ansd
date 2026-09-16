import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import { seConnecterAdmin } from "./helpers/comptes";
import { pngUni } from "./helpers/image";
import { SPEAKER_SESSION_COOKIE, signSpeakerSession } from "../src/modules/speakers/session";

/**
 * Espace intervenant (brief §5.8, PLAN.md 4.3).
 *
 * Le lien magique complet n'est pas rejouable — la base ne garde que
 * l'empreinte du jeton, ce qui est sa raison d'être. Le test emprunte donc le
 * **mécanisme de session** que ce lien produit, et éprouve tout ce qui vient
 * après : dépôts, cloisonnement, publication.
 */
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();
const NOM = `Intervenant${SUFFIXE}`;

let editionId = "";
let speakerId = "";
const emails: string[] = [];

async function connecterIntervenant(context: BrowserContext, id: string) {
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

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  editionId = edition.id;

  const email = `e2e-speaker-${randomUUID()}@example.test`;
  emails.push(email);
  speakerId = (
    await prisma.speaker.create({
      data: { editionId, email, firstName: "Awa", lastName: NOM },
    })
  ).id;
});

test.afterAll(async () => {
  /*
   * Les fichiers d'abord : supprimer la ligne seule laissait la photo et le PDF
   * sur le disque. 29 présentations orphelines, toutes marquées « test E2E »,
   * s'étaient accumulées avant qu'un contrôle du stockage ne les montre (§15.8)
   * — le défaut déjà corrigé sur les tests des logos et des contributions.
   */
  const fichiers = await prisma.speaker.findUnique({
    where: { id: speakerId },
    select: { photoPath: true, presentationPath: true },
  });
  for (const chemin of [fichiers?.photoPath, fichiers?.presentationPath]) {
    if (chemin) await fileStorage.delete(chemin).catch(() => undefined);
  }

  await prisma.magicLink.deleteMany({ where: { speakerId } });
  await prisma.speaker.deleteMany({ where: { id: speakerId } });
  await prisma.$disconnect();
});

test("le formulaire d'accès ne dit pas qui figure au programme", async ({ page }) => {
  await page.goto("/espace-intervenant");
  await expect(page.getByRole("heading", { name: "Espace intervenant" })).toBeVisible();

  await page.getByLabel("Adresse e-mail").fill("inconnu-total@example.test");
  await page.getByRole("button", { name: /Recevoir mon lien/ }).click();

  // Même réponse pour une adresse connue et une inconnue : le formulaire ne
  // doit pas devenir un moyen de savoir qui intervient.
  await expect(page.getByText(/Si cette adresse correspond/)).toBeVisible();
});

test("un lien invalide le dit, sans ouvrir de session", async ({ page }) => {
  await page.goto("/espace-intervenant/lien/jeton-inexistant");
  await expect(page).toHaveURL(/lien=invalide/);
  await expect(page.getByText(/n'est plus valable/)).toBeVisible();
});

test("l'intervenant dépose sa biographie, sa photo et sa présentation", async ({
  page,
  context,
}) => {
  await connecterIntervenant(context, speakerId);
  await page.goto("/espace-intervenant");

  await expect(page.getByText(`Awa ${NOM}`)).toBeVisible();

  await page.getByLabel("Fonction").fill("Statisticienne en chef");
  await page.getByLabel("Organisation").fill("ANSD");
  await page.getByLabel("Biographie (français)").fill("Biographie de test E2E.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Vos informations sont enregistrées.")).toBeVisible();

  await page.locator('input[name="photo"]').setInputFiles({
    name: "portrait.png",
    mimeType: "image/png",
    buffer: pngUni(120, 160, [40, 90, 160]),
  });
  await page.getByRole("button", { name: "Déposer" }).first().click();
  await expect(page.getByText("Photo enregistrée.")).toBeVisible();

  await page.locator('input[name="presentation"]').setInputFiles({
    name: "support.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% test E2E\n"),
  });
  // L'envoi part dès que le fichier est choisi, vers une route : il n'y a plus
  // de bouton, ni de plafond muet à 3 Mo (§15).
  await expect(page.getByText("Présentation enregistrée.")).toBeVisible();

  const enBase = await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId } });
  expect(enBase.jobTitle).toBe("Statisticienne en chef");
  expect(enBase.photoPath).not.toBeNull();
  expect(enBase.presentationPath).not.toBeNull();
});

test("refuse un fichier qui n'est pas un PDF pour la présentation", async ({ page, context }) => {
  await connecterIntervenant(context, speakerId);
  await page.goto("/espace-intervenant");

  // Une image renommée en .pdf : le contrôle porte sur les octets.
  await page.locator('input[name="presentation"]').setInputFiles({
    name: "piege.pdf",
    mimeType: "application/pdf",
    buffer: pngUni(10, 10, [0, 0, 0]),
  });
  await expect(page.getByText("Seuls les fichiers PDF sont acceptés.")).toBeVisible();
});

test("la présentation n'est jamais publique, la photo l'est une fois publiée", async ({
  page,
  request,
}) => {
  // Anonyme : ni l'une ni l'autre tant que l'intervenant est en brouillon.
  expect((await request.get(`/api/v1/speakers/${speakerId}/presentation`)).status()).toBe(404);
  expect((await request.get(`/api/v1/speakers/${speakerId}/photo`)).status()).toBe(404);

  await prisma.speaker.update({ where: { id: speakerId }, data: { isPublished: true } });

  // Publié : la photo devient publique, la présentation reste privée — c'est
  // un support qui appartient à son auteur.
  expect((await request.get(`/api/v1/speakers/${speakerId}/photo`)).status()).toBe(200);
  expect((await request.get(`/api/v1/speakers/${speakerId}/presentation`)).status()).toBe(404);

  await page.goto("/intervenants");
  await expect(page.getByText(`Awa ${NOM}`)).toBeVisible();
});

test("le BackOffice signale un intervenant injoignable et crée son participant", async ({
  page,
}) => {
  const orphelin = await prisma.speaker.create({
    data: { editionId, firstName: "Sans", lastName: `Adresse${SUFFIXE}` },
  });

  await seConnecterAdmin(page);
  await page.goto("/admin/intervenants");

  const ligneOrpheline = page.getByRole("row", { name: new RegExp(`Adresse${SUFFIXE}`) });
  await expect(ligneOrpheline).toContainText("Aucune adresse : injoignable");

  const ligne = page.getByRole("row", { name: new RegExp(NOM) });
  await ligne.getByRole("button", { name: "Créer le participant" }).click();

  await expect
    .poll(
      async () =>
        (await prisma.speaker.findUniqueOrThrow({ where: { id: speakerId } })).participantId,
    )
    .not.toBeNull();

  const recharge = await prisma.speaker.findUniqueOrThrow({
    where: { id: speakerId },
    select: { participantId: true },
  });
  const participant = await prisma.participant.findUniqueOrThrow({
    where: { id: recharge.participantId! },
  });
  // Le comité a déjà validé la personne en la mettant au programme.
  expect(participant.status).toBe("CONFIRMED");
  emails.push(participant.email);

  await prisma.speaker.deleteMany({ where: { id: orphelin.id } });
  await prisma.speaker.update({ where: { id: speakerId }, data: { participantId: null } });
  await prisma.participant.deleteMany({ where: { id: participant.id } });
});
