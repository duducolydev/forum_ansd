import argon2 from "argon2";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { emailE2E, seConnecterAdmin } from "./helpers/comptes";

/**
 * Failles corrigées par l'audit de sécurité (PLAN.md §18), vérifiées sur
 * l'application réelle.
 *
 * La première a été **mesurée** avant correction : un compte désactivé gardait
 * sa session ouverte et continuait d'ouvrir le BackOffice. Le parcours la rejoue
 * comme elle se produirait — l'agent connecté dans son navigateur, un
 * administrateur qui le désactive depuis l'écran des comptes.
 */

test.describe.configure({ mode: "serial", timeout: 180_000 });

const MOT_DE_PASSE = "Agent-E2E-Sessions-2026!";
const comptes: string[] = [];

test.afterAll(async () => {
  await prisma.auditLog.deleteMany({
    where: { OR: [{ actorUserId: { in: comptes } }, { entityId: { in: comptes } }] },
  });
  await prisma.user.deleteMany({ where: { id: { in: comptes } } });
  await prisma.$disconnect();
});

/** Agent d'accueil : rôle sans second facteur, avec un écran du BackOffice. */
async function creerAgent(): Promise<{ id: string; email: string }> {
  const role = await prisma.role.findFirstOrThrow({ where: { name: "AGENT_ACCUEIL" } });
  const email = emailE2E("session");
  const compte = await prisma.user.create({
    data: {
      email,
      name: "Agent E2E sessions",
      passwordHash: await argon2.hash(MOT_DE_PASSE, { type: argon2.argon2id }),
      roleId: role.id,
    },
  });
  comptes.push(compte.id);
  return { id: compte.id, email };
}

test("un compte désactivé perd aussitôt sa session ouverte, même réactivé ensuite", async ({
  browser,
  page,
}) => {
  const agent = await creerAgent();

  // L'agent se connecte dans son propre navigateur.
  const contexteAgent = await browser.newContext();
  const pageAgent = await contexteAgent.newPage();
  await pageAgent.goto("/connexion");
  await pageAgent.getByLabel("Adresse e-mail").fill(agent.email);
  await pageAgent.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await pageAgent.getByRole("button", { name: "Se connecter" }).click();
  await pageAgent.waitForURL((url) => !url.pathname.startsWith("/connexion"));

  await pageAgent.goto("/admin/presences");
  await expect(pageAgent.getByRole("heading", { name: "Présences" })).toBeVisible();

  // Un administrateur le désactive depuis l'écran des comptes.
  await seConnecterAdmin(page);
  await page.goto("/admin/utilisateurs");
  const carte = page.getByTestId("carte-utilisateur").filter({ hasText: agent.email });
  await carte.getByLabel("Compte actif").uncheck();
  await carte.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carte.getByText("Compte mis à jour.")).toBeVisible();

  // La session ouverte ne donne plus rien : ni page, ni API.
  await pageAgent.goto("/admin/presences");
  await expect(pageAgent).toHaveURL(/\/connexion/);
  const api = await pageAgent.request.get("/api/v1/presences/export?jour=2026-11-23");
  expect(api.status()).toBe(401);

  // Réactivé, le compte ne rouvre pas les sessions d'avant : il faut se reconnecter.
  await page.reload();
  const carteApres = page.getByTestId("carte-utilisateur").filter({ hasText: agent.email });
  await carteApres.getByLabel("Compte actif").check();
  await carteApres.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carteApres.getByText("Compte mis à jour.")).toBeVisible();

  await pageAgent.goto("/admin/presences");
  await expect(pageAgent).toHaveURL(/\/connexion/);

  await contexteAgent.close();
});

test("un second facteur actif ne se remplace pas depuis la page d'enrôlement", async ({ page }) => {
  // Le compte E2E a son second facteur activé. Avant correction, la page lui
  // proposait un nouveau secret, et l'action l'enregistrait par-dessus.
  await seConnecterAdmin(page);

  await page.goto("/admin/2fa/enroll");

  await expect(page).not.toHaveURL(/\/2fa\/enroll/);
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
});

test("une IP forgée en tête de X-Forwarded-For ne contourne pas la limite de débit", async ({
  request,
}) => {
  /*
   * Mesuré avant correction : 35 vérifications avec la même IP, 5 refusées ;
   * en changeant le premier élément de l'en-tête à chaque fois, aucune. Le
   * dernier élément reste ici constant, comme l'ajouterait un proxy qui
   * complète l'en-tête — il est tiré au hasard pour ne pas partager le
   * compteur d'une autre exécution.
   */
  const octet = () => Math.floor(Math.random() * 250) + 1;
  const reelle = `10.${octet()}.${octet()}.${octet()}`;

  const statuts: number[] = [];
  for (let i = 0; i < 35; i++) {
    const reponse = await request.get(`/api/v1/badges/verify/jeton-e2e-inexistant-${i}`, {
      headers: { "X-Forwarded-For": `198.51.100.${i}, ${reelle}` },
    });
    statuts.push(reponse.status());
  }

  // Limite de 30 par minute : les 5 dernières au moins sont refusées.
  expect(statuts.filter((statut) => statut === 429).length).toBeGreaterThanOrEqual(5);
});
