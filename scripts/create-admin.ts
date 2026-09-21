import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../src/lib/db";
import { audit } from "../src/lib/audit";
import { ROLE_LABELS } from "../src/lib/permissions";
import { exigeSecondFacteur } from "../src/modules/auth/service";

/**
 * Création (ou remise à niveau) d'un compte BackOffice.
 *
 * Sert à amorcer le premier administrateur en production — le seed ne crée
 * qu'un compte de **démonstration**, aux identifiants publiés dans le README,
 * qui n'a rien à faire sur un serveur réel.
 *
 *   pnpm create:admin <email> <mot-de-passe> [RÔLE]
 *
 * Le rôle par défaut est SUPER_ADMIN. Sur un compte existant, seuls le mot de
 * passe et le rôle sont mis à jour : la 2FA déjà activée est conservée.
 */
async function main(): Promise<void> {
  const [email, password, roleName = "SUPER_ADMIN"] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage : pnpm create:admin <email> <mot-de-passe> [RÔLE]");
    console.error(`Rôles : ${Object.keys(ROLE_LABELS).join(", ")}`);
    process.exit(1);
  }

  // Un mot de passe court sur un compte qui donne accès à toutes les données
  // personnelles du Forum n'est pas une décision à laisser passer en silence.
  if (password.length < 12) {
    console.error("Mot de passe trop court : 12 caractères minimum pour un compte BackOffice.");
    process.exit(1);
  }

  const role = await prisma.role.findFirst({ where: { name: roleName } });
  if (!role) {
    console.error(`Rôle inconnu : ${roleName}`);
    process.exit(1);
  }

  const normalisedEmail = email.trim().toLowerCase();
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const existing = await prisma.user.findUnique({ where: { email: normalisedEmail } });

  const user = await prisma.user.upsert({
    where: { email: normalisedEmail },
    update: {
      passwordHash,
      roleId: role.id,
      isActive: true,
      // Un compte verrouillé par des échecs répétés redevient utilisable.
      failedAttempts: 0,
      lockedUntil: null,
    },
    create: {
      email: normalisedEmail,
      name: normalisedEmail.split("@")[0]!,
      passwordHash,
      roleId: role.id,
      isActive: true,
    },
  });

  await audit.log({
    actorType: "SYSTEM",
    action: existing ? "user.reset_by_script" : "user.created_by_script",
    entity: "User",
    entityId: user.id,
    after: { email: normalisedEmail, role: roleName },
  });

  const secondFacteur = exigeSecondFacteur(roleName);

  console.log("");
  console.log(existing ? "Compte mis à jour." : "Compte créé.");
  console.log(`  E-mail    : ${normalisedEmail}`);
  console.log(`  Rôle      : ${roleName} (${ROLE_LABELS[roleName] ?? roleName})`);
  console.log(
    `  2FA       : ${secondFacteur ? "code envoyé par e-mail à chaque connexion" : "aucune"}`,
  );
  console.log("");

  await prisma.$disconnect();
  process.exit(0);
}

main();
