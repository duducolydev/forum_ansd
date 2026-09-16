import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { buildBadgeToken, hashBadgeToken } from "../src/modules/badges/token";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Scanner hors ligne (brief §5.6, PLAN.md 4.2).
 *
 * Le test ne pilote pas de caméra : Playwright n'en a pas, et un flux vidéo
 * simulé n'éprouverait que le décodeur, qui n'est pas la partie risquée. Ce qui
 * l'est — le verdict rendu sans réseau, la file qui ne perd rien, la reprise
 * sans doublon — passe par la **recherche manuelle**, qui est de toute façon un
 * chemin exigé par le brief pour les QR illisibles.
 */
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();
const CODE_ZONE = `ZE2E${SUFFIXE}`;

let editionId = "";
let zoneId = "";
let checkpointOuvertId = "";
let checkpointFermeId = "";
const emails: string[] = [];
const participants: { publicId: string; nom: string }[] = [];

async function creerParticipantAvecBadge(prenom: string, nom: string) {
  const email = `e2e-scan-${randomUUID()}@example.test`;
  emails.push(email);

  const categorie = await prisma.participantCategory.findFirstOrThrow({
    where: { editionId, code: "PARTICIPANT_NATIONAL" },
  });
  const edition = await prisma.edition.findUniqueOrThrow({ where: { id: editionId } });

  const publicId = `${edition.code.replace("-", "").slice(0, 5)}-E2E${SUFFIXE.slice(0, 3)}${participants.length}`;
  const participant = await prisma.participant.create({
    data: {
      editionId,
      publicId,
      firstName: prenom,
      lastName: nom,
      email,
      country: "Sénégal",
      organization: "ANSD",
      categoryId: categorie.id,
      status: "CONFIRMED",
      source: "ONSITE",
      confirmedAt: new Date(),
    },
  });

  await prisma.badge.create({
    data: {
      participantId: participant.id,
      version: 1,
      qrToken: hashBadgeToken(buildBadgeToken(publicId, 1)),
      generatedAt: new Date(),
    },
  });

  participants.push({ publicId, nom: `${prenom} ${nom}` });
  return participant;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
  editionId = edition.id;

  const zone = await prisma.zone.create({
    data: { editionId, code: CODE_ZONE, name: `Zone E2E scan ${SUFFIXE}` },
  });
  zoneId = zone.id;

  // La zone de test est ouverte à la catégorie des participants nationaux ;
  // l'espace VIP du jeu de démonstration ne l'est pas — d'où deux postes, un
  // par verdict attendu.
  const categorie = await prisma.participantCategory.findFirstOrThrow({
    where: { editionId, code: "PARTICIPANT_NATIONAL" },
  });
  await prisma.categoryZone.create({ data: { categoryId: categorie.id, zoneId } });

  const zoneVip = await prisma.zone.findFirstOrThrow({ where: { editionId, code: "VIP" } });

  checkpointOuvertId = (
    await prisma.checkpoint.create({
      data: { editionId, zoneId, name: `Poste ouvert ${SUFFIXE}` },
    })
  ).id;
  checkpointFermeId = (
    await prisma.checkpoint.create({
      data: { editionId, zoneId: zoneVip.id, name: `Poste VIP ${SUFFIXE}` },
    })
  ).id;

  await creerParticipantAvecBadge("Aminata", `Sow${SUFFIXE.slice(0, 3)}`);
  await creerParticipantAvecBadge("Oumar", `Ba${SUFFIXE.slice(0, 3)}`);
});

test.afterAll(async () => {
  await prisma.scanLog.deleteMany({
    where: { checkpointId: { in: [checkpointOuvertId, checkpointFermeId] } },
  });
  await prisma.checkpoint.deleteMany({
    where: { id: { in: [checkpointOuvertId, checkpointFermeId] } },
  });
  await prisma.participant.deleteMany({ where: { email: { in: emails } } });
  await prisma.zone.deleteMany({ where: { id: zoneId } });
  await prisma.$disconnect();
});

/** Le manifeste est chargé quand le compteur de badges embarqués est non nul. */
async function attendreManifeste(page: import("@playwright/test").Page) {
  // Sur l'identifiant et non sur le libellé : un mot change dans l'en-tête ne
  // doit pas faire échouer un test qui porte sur le chargement du manifeste.
  await expect(page.getByTestId("manifeste")).toContainText(/[1-9]\d* badges/, {
    timeout: 20_000,
  });
}

async function scannerManuellement(page: import("@playwright/test").Page, publicId: string) {
  await page.getByRole("button", { name: "Recherche manuelle" }).click();
  const champ = page.getByLabel("Nom, organisation ou identifiant");
  await champ.fill("");
  await champ.fill(publicId);
  await page.getByRole("button", { name: new RegExp(publicId) }).click();
}

test("rend un verdict vert au poste ouvert et rouge au poste fermé", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/scan");
  await attendreManifeste(page);

  await page
    .getByLabel("Point de contrôle")
    .selectOption({ label: `Poste ouvert ${SUFFIXE} — ${CODE_ZONE}` });
  await scannerManuellement(page, participants[0]!.publicId);

  const verdict = page.getByTestId("verdict");
  await expect(verdict).toHaveAttribute("data-couleur", "VERT");
  await expect(verdict).toContainText("Accès autorisé");
  await expect(verdict).toContainText(participants[0]!.nom);
  await verdict.click();

  await page.getByLabel("Point de contrôle").selectOption({ label: `Poste VIP ${SUFFIXE} — VIP` });
  await scannerManuellement(page, participants[0]!.publicId);

  await expect(page.getByTestId("verdict")).toHaveAttribute("data-couleur", "ROUGE");
  await expect(page.getByTestId("verdict")).toContainText("Zone non autorisée");
});

test("rend son verdict sans réseau, met le scan en file et le remonte au retour", async ({
  page,
  context,
}) => {
  await seConnecterAdmin(page);
  await page.goto("/scan");
  await attendreManifeste(page);
  await page
    .getByLabel("Point de contrôle")
    .selectOption({ label: `Poste ouvert ${SUFFIXE} — ${CODE_ZONE}` });

  // Un premier scan en ligne : la file doit se vider d'elle-même.
  await scannerManuellement(page, participants[0]!.publicId);
  await expect(page.getByTestId("verdict")).toHaveAttribute("data-couleur", "VERT");
  await page.getByTestId("verdict").click();
  await expect(page.getByTestId("en-file")).toHaveText("0 en attente");

  // Coupure réseau : c'est le seul moment qui compte vraiment.
  await context.setOffline(true);
  await expect(page.getByTestId("etat-reseau")).toHaveText("Hors ligne");

  await scannerManuellement(page, participants[1]!.publicId);
  const horsLigne = page.getByTestId("verdict");
  await expect(horsLigne).toHaveAttribute("data-couleur", "VERT");
  await expect(horsLigne).toContainText(participants[1]!.nom);
  await horsLigne.click();
  await expect(page.getByTestId("en-file")).toHaveText("1 en attente");

  // Second passage au même poste, toujours hors ligne : l'anti-double-scan
  // doit fonctionner sans serveur, sinon la règle disparaît quand elle sert.
  await scannerManuellement(page, participants[1]!.publicId);
  await expect(page.getByTestId("verdict")).toHaveAttribute("data-couleur", "ORANGE");
  await expect(page.getByTestId("verdict")).toContainText("Déjà scanné ici");
  await page.getByTestId("verdict").click();
  await expect(page.getByTestId("en-file")).toHaveText("2 en attente");

  // Retour du réseau.
  await context.setOffline(false);
  await page.getByRole("button", { name: "Synchroniser" }).click();
  await expect(page.getByTestId("en-file")).toHaveText("0 en attente");
  await expect(page.getByTestId("etat-reseau")).toHaveText("En ligne");

  // Compte sur le second participant seulement : le premier a déjà été scanné
  // par le test précédent, et une attente globale dépendrait de l'ordre.
  const remontes = await prisma.scanLog.findMany({
    where: {
      checkpointId: checkpointOuvertId,
      participant: { publicId: participants[1]!.publicId },
    },
    select: { clientScanId: true, result: true },
  });

  expect(remontes).toHaveLength(2);
  expect(remontes.map((ligne) => ligne.result).sort()).toEqual(["ALREADY", "OK"]);
  // La propriété qui compte : la reprise réseau n'a rien duplique.
  expect(new Set(remontes.map((ligne) => ligne.clientScanId)).size).toBe(2);

  const presence = await prisma.participant.findFirstOrThrow({
    where: { publicId: participants[1]!.publicId },
  });
  expect(presence.status).toBe("CHECKED_IN");
});

test("réserve la caméra au scanner et la refuse partout ailleurs", async ({ request }) => {
  // Sans session, /scan redirige : sans cette option, on lirait les en-têtes
  // de la page de connexion et le test ne prouverait rien.
  const scan = await request.get("/scan", { maxRedirects: 0 });
  expect(scan.headers()["permissions-policy"]).toContain("camera=(self)");

  const accueil = await request.get("/");
  expect(accueil.headers()["permissions-policy"]).toContain("camera=()");
});
