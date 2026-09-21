import "dotenv/config";
import argon2 from "argon2";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { prisma } from "../../src/lib/db";

/**
 * Compte administrateur dédié aux tests de bout en bout.
 *
 * Il est **distinct** du compte de démonstration du seed : les tests ne doivent
 * pas dépendre d'identifiants publiés dans le README, ni les invalider en cas
 * de verrouillage après échecs répétés.
 */
export const ADMIN_E2E = {
  email: "e2e.admin@example.test",
  password: "E2E!Forum-Test-2026",
  role: "SUPER_ADMIN",
} as const;

/** Marqueur commun à toutes les données créées par les tests, pour le nettoyage. */
export const E2E_PREFIX = "e2e-";

/**
 * Prépare le compte et renvoie son identifiant.
 *
 * Volontairement exécuté **à chaque connexion** et non mémorisé : c'est ici que
 * le compteur d'échecs est remis à zéro. Sans cela, un premier essai malheureux
 * laissait le compteur monter jusqu'au verrouillage de 15 minutes, qui faisait
 * ensuite échouer tous les tests suivants.
 */
export async function ensureAdminE2E(): Promise<string> {
  const role = await prisma.role.findFirstOrThrow({ where: { name: ADMIN_E2E.role } });
  const passwordHash = await argon2.hash(ADMIN_E2E.password, { type: argon2.argon2id });

  const compte = await prisma.user.upsert({
    where: { email: ADMIN_E2E.email },
    update: {
      passwordHash,
      roleId: role.id,
      isActive: true,
      // Un test qui échoue peut laisser le compte verrouillé : on repart propre.
      failedAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: ADMIN_E2E.email,
      name: "Administrateur E2E",
      passwordHash,
      roleId: role.id,
      isActive: true,
    },
  });

  return compte.id;
}

/**
 * Code de connexion en attente pour ce compte (PLAN.md §23).
 *
 * Lu **en base** et non dans Mailpit : le message part par la file, avec le
 * délai que cela suppose, alors que la demande de validation, elle, est écrite
 * avant même que le formulaire réponde. Le parcours reste celui d'un
 * administrateur — c'est la boîte aux lettres qui est court-circuitée, pas
 * l'authentification.
 */
async function codeEnAttente(userId: string): Promise<string> {
  for (let essai = 0; essai < 20; essai++) {
    const defi = await prisma.adminLoginChallenge.findFirst({
      where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (defi) return defi.code6;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Aucun code de connexion n'a été créé pour le compte E2E.");
}

/**
 * Connexion par le **vrai formulaire**, pas en injectant un cookie de session :
 * les tests doivent emprunter le même chemin qu'un administrateur, second
 * facteur compris.
 *
 * La page de connexion doit déjà être ouverte (`attendue` sert aux parcours qui
 * arrivent par une redirection, comme le scanner).
 */
export async function validerConnexion(
  page: Page,
  userId: string,
  attendue: RegExp = /\/admin/,
): Promise<void> {
  await page.getByLabel("Adresse e-mail").fill(ADMIN_E2E.email);
  await page.getByLabel("Mot de passe").fill(ADMIN_E2E.password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  // Premier envoi : le mot de passe est accepté et un code part par e-mail.
  await expect(page.getByText(/code à 6 chiffres/i)).toBeVisible({ timeout: 15_000 });

  await page.getByLabel("Code reçu par e-mail").fill(await codeEnAttente(userId));
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(attendue, { timeout: 15_000 });
}

/**
 * Session administrateur, réutilisée d'un test à l'autre.
 *
 * Le second facteur plafonne les demandes de code à **trois par minute et par
 * compte** (PLAN.md §23). La suite ouvre plus de cent sessions
 * d'administration : à raison d'une connexion complète par test, le garde-fou du
 * produit refusait les demandes et quinze tests échouaient sur « Trop de
 * demandes de code » — mesuré, page à l'appui. Le facteur est donc traversé une
 * fois, puis les cookies obtenus sont réinjectés dans les contextes suivants.
 *
 * Ce raccourci ne masque rien : si la connexion casse, le premier test à passer
 * ici échoue, et les deux chemins du facteur — le code et le lien — gardent
 * leurs tests dédiés dans `securite-sessions.spec.ts`. Une session devenue
 * caduque (compte désactivé, version de session incrémentée) refait le parcours
 * complet.
 */
let cookiesAdmin: Parameters<BrowserContext["addCookies"]>[0] | null = null;

export async function seConnecterAdmin(page: Page): Promise<void> {
  if (cookiesAdmin) {
    await page.context().addCookies(cookiesAdmin);
    await page.goto("/admin");
    if (!page.url().includes("/connexion")) return;
    cookiesAdmin = null;
  }

  const userId = await ensureAdminE2E();
  await page.goto("/connexion");
  await validerConnexion(page, userId);
  cookiesAdmin = (await page.context().storageState()).cookies;
}

/** Adresse unique et repérable, pour que le nettoyage soit sans ambiguïté. */
export function emailE2E(sujet: string): string {
  return `${E2E_PREFIX}${sujet}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}
