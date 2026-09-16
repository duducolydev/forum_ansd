import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { NAV_GROUPS } from "../src/components/admin/nav";
import { emailE2E, seConnecterAdmin } from "./helpers/comptes";

/**
 * Administration : utilisateurs, journal d'audit, sponsors (brief §5.9, §5.14).
 *
 * Ces trois écrans manquaient alors que le menu y menait : les quatre entrées
 * « Contributions », « Sponsors », « Utilisateurs » et « Journal d'audit »
 * renvoyaient une 404. Ce fichier vérifie que les trois qui relèvent des lots
 * déjà livrés existent et fonctionnent, et que la quatrième n'est plus annoncée.
 */

const creesUtilisateurs: string[] = [];

/** Préfixe commun : le nettoyage ne dépend pas des identifiants collectés. */
const NOM_SPONSOR_TEST = "Partenaire E2E";

/*
 * Nettoyage par préfixe et non par identifiants mémorisés : un test qui échoue
 * avant d'avoir noté l'identifiant laissait sinon son sponsor sur la page
 * publique, et l'exécution suivante s'y heurtait.
 */
test.afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: creesUtilisateurs } } });
  await prisma.user.deleteMany({ where: { id: { in: creesUtilisateurs } } });
  await prisma.sponsor.deleteMany({ where: { name: { startsWith: NOM_SPONSOR_TEST } } });
  await prisma.$disconnect();
});

/**
 * Le test qui manquait.
 *
 * Quatre entrées du menu ont mené à une 404 sans que rien ne s'en aperçoive :
 * la navigation était une liste écrite à la main, et aucun test ne la
 * confrontait aux pages réellement présentes. Celui-ci parcourt la source du
 * menu plutôt qu'une liste recopiée — ajouter demain une entrée vers une page
 * absente le fera échouer.
 */
test("chaque entrée du menu mène à une page existante", async ({ page }) => {
  await seConnecterAdmin(page);

  const entrees = NAV_GROUPS.flatMap((groupe) => groupe.items);
  expect(entrees.length).toBeGreaterThan(10);

  for (const entree of entrees) {
    const reponse = await page.goto(entree.href);
    expect(reponse?.status(), `« ${entree.label} » (${entree.href})`).toBe(200);
  }
});

test("les trois écrans ajoutés s'affichent, et Contributions est annoncé", async ({ page }) => {
  await seConnecterAdmin(page);

  for (const chemin of ["/admin/utilisateurs", "/admin/audit", "/admin/sponsors"]) {
    await page.goto(chemin);
    await expect(page.locator("h2").first()).toBeVisible();
  }

  // Contributions a longtemps été retiré du menu, faute d'écran. L'écran existe
  // désormais (§15) : l'entrée revient, et le test précédent garantit qu'elle
  // mène à une page qui répond.
  await page.goto("/admin");
  await expect(page.getByRole("link", { name: "Contributions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Utilisateurs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Journal d'audit" })).toBeVisible();
});

test("crée un compte, l'affiche, puis refuse de se désactiver soi-même", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/utilisateurs");

  const email = emailE2E("utilisateur");
  await page.getByRole("group").filter({ hasText: "Créer un compte" }).click();
  await page.getByLabel("Nom et prénom").fill("Agent de test E2E");
  await page.getByLabel("Adresse électronique").fill(email);
  await page.getByLabel("Rôle", { exact: true }).first().selectOption({ label: "Lecteur" });
  await page.getByRole("button", { name: "Tirer" }).first().click();
  await page.getByRole("button", { name: "Créer le compte" }).click();

  await expect(page.getByText(email)).toBeVisible();

  const cree = await prisma.user.findUniqueOrThrow({ where: { email } });
  creesUtilisateurs.push(cree.id);
  // Le mot de passe tiré dans le navigateur doit avoir été haché, jamais stocké tel quel.
  expect(cree.passwordHash.startsWith("$argon2")).toBe(true);

  // La création laisse une trace nominative : c'est tout l'objet du §5.14.
  const trace = await prisma.auditLog.findFirst({
    where: { entity: "User", entityId: cree.id, action: "user.created" },
  });
  expect(trace).not.toBeNull();

  // Sur sa propre carte, le rôle et l'état sont verrouillés : on ne se retire
  // pas ses propres droits depuis cet écran.
  const maCarte = page
    .getByTestId("carte-utilisateur")
    .filter({ hasText: "e2e.admin@example.test" });
  await expect(maCarte.getByRole("combobox")).toBeDisabled();
  await expect(maCarte.getByRole("checkbox")).toBeDisabled();
});

test("le journal d'audit se filtre et s'exporte en CSV", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/audit");

  // La connexion qui vient d'avoir lieu doit y figurer. Le filtre est scopé au
  // journal : « auth.login » est aussi le texte d'une option du menu déroulant.
  await page.getByLabel("Action").selectOption("auth.login");
  await expect(page.getByTestId("journal").getByText("auth.login").first()).toBeVisible();

  const telechargement = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exporter en CSV" }).click();
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/^journal-audit-\d{4}-\d{2}-\d{2}\.csv$/);

  // L'export est lui-même une action journalisée.
  const trace = await prisma.auditLog.findFirst({
    where: { action: "audit.exported" },
    orderBy: { createdAt: "desc" },
  });
  expect(trace).not.toBeNull();
});

test("crée un sponsor et le publie sur le site", async ({ page }) => {
  await seConnecterAdmin(page);
  await page.goto("/admin/sponsors");

  const nom = `${NOM_SPONSOR_TEST} ${Date.now()}`;
  await page.getByRole("link", { name: "Ajouter" }).click();
  await page.getByLabel("Nom *").fill(nom);
  await page.getByLabel("Niveau *").selectOption({ index: 1 });
  await page.getByLabel("Site web").fill("https://www.ansd.sn");
  await page.getByLabel("Numéro de stand").fill("A12");
  await page.getByLabel("E-mail du contact").fill("contact-interne@example.test");
  await page.getByLabel("Publié sur le site").check();
  await page.getByRole("button", { name: "Créer le sponsor" }).click();

  // On attend la fiche elle-même : `/admin/sponsors/nouveau` satisfaisait déjà
  // une attente sur l'URL, et la vérification en base partait avant la fin de
  // l'action serveur.
  await expect(page.getByRole("heading", { name: nom })).toBeVisible();
  await prisma.sponsor.findFirstOrThrow({ where: { name: nom } });

  // Le partenaire apparaît sur la page publique, avec son lien et son stand.
  // L'assertion est scopée à sa propre vignette : plusieurs partenaires peuvent
  // porter le même numéro de stand d'une exécution à l'autre.
  await page.goto("/sponsors");
  const vignette = page.getByRole("link", { name: new RegExp(nom) });
  await expect(vignette).toBeVisible();
  await expect(vignette).toContainText("Stand A12");
  await expect(vignette).toHaveAttribute("href", "https://www.ansd.sn");

  // …mais le contact interne n'y figure sous aucune forme (§5.9).
  expect(await page.content()).not.toContain("contact-interne@example.test");
});
