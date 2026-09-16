import "dotenv/config";
import argon2 from "argon2";
import type { Page } from "@playwright/test";
import { prisma } from "../../src/lib/db";
import { codeTotp, genererSecret, secondesAvantRotation } from "./totp";

/**
 * Compte administrateur dédié aux tests de bout en bout.
 *
 * Il est **distinct** du compte de démonstration du seed : les tests ne doivent
 * pas dépendre d'identifiants publiés dans le README, ni les invalider en cas
 * de verrouillage après échecs répétés. Sa 2FA est pré-activée avec un secret
 * fixe, ce qui rend la connexion reproductible sans intervention manuelle.
 */
export const ADMIN_E2E = {
  email: "e2e.admin@example.test",
  password: "E2E!Forum-Test-2026",
  role: "SUPER_ADMIN",
} as const;

/** Marqueur commun à toutes les données créées par les tests, pour le nettoyage. */
export const E2E_PREFIX = "e2e-";

/**
 * Prépare le compte et renvoie son secret TOTP.
 *
 * Volontairement exécuté **à chaque connexion** et non mémorisé : c'est ici que
 * le compteur d'échecs est remis à zéro. Avec un court-circuit sur le secret en
 * cache, un premier essai malheureux (code TOTP expiré entre la lecture et la
 * soumission) laissait le compteur monter, jusqu'au verrouillage de 15 minutes
 * qui faisait ensuite échouer tous les tests suivants.
 */
export async function ensureAdminE2E(): Promise<string> {
  const role = await prisma.role.findFirstOrThrow({ where: { name: ADMIN_E2E.role } });
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_E2E.email } });

  // Secret conservé d'une exécution à l'autre : réenrôler à chaque fois
  // invaliderait les codes en vol et rendrait les tests instables.
  const secret = existing?.totpSecret ?? genererSecret();
  const passwordHash = await argon2.hash(ADMIN_E2E.password, { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: ADMIN_E2E.email },
    update: {
      passwordHash,
      roleId: role.id,
      isActive: true,
      totpEnabled: true,
      totpSecret: secret,
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
      totpEnabled: true,
      totpSecret: secret,
    },
  });

  return secret;
}

/**
 * Connexion par le **vrai formulaire**, pas en injectant un cookie de session :
 * les tests doivent emprunter le même chemin qu'un administrateur.
 *
 * Un second essai est prévu : le code TOTP change toutes les 30 secondes, et
 * une soumission qui tombe juste après une rotation est refusée. Sans cette
 * tolérance, la suite échouait au hasard — et un test qui échoue au hasard
 * finit par être ignoré.
 */
export async function seConnecterAdmin(page: Page): Promise<void> {
  const secret = await ensureAdminE2E();

  for (let essai = 0; essai < 2; essai++) {
    // On attend la rotation plutôt que de saisir un code en fin de vie.
    if (secondesAvantRotation() < 5) {
      await page.waitForTimeout((secondesAvantRotation() + 1) * 1000);
    }

    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(ADMIN_E2E.email);
    await page.getByLabel("Mot de passe").fill(ADMIN_E2E.password);
    await page.getByLabel(/Code de vérification/).fill(codeTotp(secret));
    await page.getByRole("button", { name: "Se connecter" }).click();

    try {
      await page.waitForURL(/\/admin/, { timeout: 15_000 });
      return;
    } catch {
      if (essai === 1) {
        const message = await page.locator("p.text-danger-text").first().textContent();
        throw new Error(`Connexion impossible après deux essais — message : ${message ?? "aucun"}`);
      }
    }
  }
}

/** Adresse unique et repérable, pour que le nettoyage soit sans ambiguïté. */
export function emailE2E(sujet: string): string {
  return `${E2E_PREFIX}${sujet}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
}
