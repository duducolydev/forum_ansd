import "dotenv/config";
import { randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import argon2 from "argon2";
import { prisma } from "../src/lib/db";
import { ROLE_LABELS } from "../src/lib/permissions";
import { ROLES_REQUIRING_TOTP } from "../src/modules/auth/service";

/**
 * Comptes de démonstration, un par rôle (brief §12).
 *
 * Le script **crée les comptes et écrit le fichier** dans le même passage :
 * une liste tenue à la main aurait fini par annoncer des mots de passe qui ne
 * fonctionnent plus, ce qui est pire qu'une absence de liste.
 *
 *     pnpm comptes:demo
 *
 * Les mots de passe sont **tirés au hasard à chaque exécution** plutôt que fixés
 * dans le code : rien de secret ne vit dans le dépôt, et relancer le script fait
 * une rotation. Le fichier produit est ignoré par git.
 *
 * Destiné à une instance de test. Sur un serveur réel, on crée les comptes
 * nominativement avec `pnpm create:admin`.
 */

/** Alphabet sans caractères ambigus : ces mots de passe seront recopiés à la main. */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SIGNES = "!@#%&*-+=?";

function motDePasse(): string {
  const corps = Array.from({ length: 16 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  // Un signe et un chiffre garantis, où qu'ils tombent dans le tirage.
  return `${corps}${SIGNES[randomInt(SIGNES.length)]}${randomInt(10)}`;
}

interface CompteDemo {
  role: string;
  email: string;
  nom: string;
  aQuoiCaSert: string;
}

const COMPTES: CompteDemo[] = [
  /*
   * Les deux rôles soumis à la 2FA portent les adresses réelles du
   * responsable : l'enrôlement d'un second facteur se fait une fois, sur un
   * téléphone, et rattacher cela à une adresse fictive rendrait le compte
   * inutilisable dès qu'on change de poste.
   */
  {
    role: "ADMIN_FORUM",
    email: "duducoly.dev@gmail.com",
    nom: "Doudou Coly",
    aQuoiCaSert: "Tout le métier, sauf utilisateurs, paramètres et éditions.",
  },
  {
    role: "SUPER_ADMIN",
    email: "doudou.coly@unchk.edu.sn",
    nom: "Doudou Coly",
    aQuoiCaSert: "Tout, y compris utilisateurs, paramètres et journal d'audit.",
  },
  {
    role: "GESTIONNAIRE_PARTICIPANTS",
    email: "participants@demo.ansd.sn",
    nom: "Gestionnaire Participants",
    aQuoiCaSert: "Participants, invitations, délégations, badges, envois groupés.",
  },
  {
    role: "AGENT_ACCUEIL",
    email: "accueil@demo.ansd.sn",
    nom: "Agent Accueil",
    aQuoiCaSert: "Scanner, présences, comptoir d'accueil, impression de badges.",
  },
  {
    role: "GESTIONNAIRE_PROGRAMME",
    email: "programme@demo.ansd.sn",
    nom: "Gestionnaire Programme",
    aQuoiCaSert: "Sessions, intervenants, inscriptions aux panels, contributions.",
  },
  {
    role: "GESTIONNAIRE_COMMUNICATION",
    email: "communication@demo.ansd.sn",
    nom: "Gestionnaire Communication",
    aQuoiCaSert: "Contenus du site, sponsors, envois groupés.",
  },
  {
    role: "GESTIONNAIRE_STATISTIQUES",
    email: "statistiques@demo.ansd.sn",
    nom: "Gestionnaire Statistiques",
    aQuoiCaSert: "Tableau de bord et rapports, en lecture et en export.",
  },
  {
    role: "LECTEUR",
    email: "lecteur@demo.ansd.sn",
    nom: "Lecteur",
    aQuoiCaSert: "Consultation seule : aucune écriture nulle part.",
  },
];

function ligne(colonnes: string[], largeurs: number[]): string {
  return colonnes.map((valeur, index) => valeur.padEnd(largeurs[index]!)).join("  ");
}

async function main(): Promise<void> {
  const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const crees: (CompteDemo & { mdp: string; deuxFacteurs: boolean })[] = [];

  for (const compte of COMPTES) {
    const role = await prisma.role.findFirst({ where: { name: compte.role } });
    if (!role) {
      console.error(`Rôle absent en base : ${compte.role}. Lancez d'abord \`pnpm db:seed\`.`);
      process.exit(1);
    }

    const mdp = motDePasse();
    await prisma.user.upsert({
      where: { email: compte.email },
      update: {
        passwordHash: await argon2.hash(mdp, { type: argon2.argon2id }),
        roleId: role.id,
        name: compte.nom,
        isActive: true,
        // Un compte verrouillé par des essais ratés redevient utilisable.
        failedAttempts: 0,
        lockedUntil: null,
      },
      create: {
        email: compte.email,
        name: compte.nom,
        passwordHash: await argon2.hash(mdp, { type: argon2.argon2id }),
        roleId: role.id,
        isActive: true,
      },
    });

    crees.push({
      ...compte,
      mdp,
      deuxFacteurs: (ROLES_REQUIRING_TOTP as readonly string[]).includes(compte.role),
    });
  }

  const obsoletes = await prisma.user.deleteMany({
    where: { email: { in: ["super.admin@demo.ansd.sn", "admin.forum@demo.ansd.sn"] } },
  });
  if (obsoletes.count > 0) {
    console.log(`${obsoletes.count} compte(s) de démonstration privilégié(s) supprimé(s).`);
  }

  const participant = await prisma.participant.findFirst({
    where: { email: { startsWith: "demo." }, status: { in: ["CONFIRMED", "BADGED"] } },
    select: { email: true, publicId: true, firstName: true, lastName: true },
  });
  const intervenant = await prisma.speaker.findFirst({
    where: { email: { not: null } },
    select: { email: true, firstName: true, lastName: true },
  });

  /*
   * Inventaire des autres comptes BackOffice.
   *
   * Le fichier doit dire ce qui **existe** et pas seulement ce que ce script a
   * créé : un compte de démonstration au mot de passe publié, ou un compte
   * technique de test, survivent très bien jusqu'en production quand personne
   * ne les a sous les yeux.
   */
  const autres = await prisma.user.findMany({
    where: { email: { notIn: crees.map((compte) => compte.email) } },
    orderBy: { email: "asc" },
    select: { email: true, totpEnabled: true, role: { select: { name: true } } },
  });

  const largeurs = [30, 30, 20];
  const tableau = [
    ligne(["ADRESSE", "MOT DE PASSE", "RÔLE"], largeurs),
    ligne(["-".repeat(30), "-".repeat(30), "-".repeat(20)], largeurs),
    ...crees.map((compte) =>
      ligne([compte.email, compte.mdp, ROLE_LABELS[compte.role] ?? compte.role], largeurs),
    ),
  ].join("\n");

  const roles = crees
    .map(
      (compte) =>
        `${compte.role}${compte.deuxFacteurs ? "  (2FA obligatoire)" : ""}\n` +
        `    ${compte.email}\n` +
        `    ${compte.aQuoiCaSert}`,
    )
    .join("\n\n");

  const contenu = `COMPTES DE DÉMONSTRATION — Forum international sur les données
Généré le ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC par \`pnpm comptes:demo\`

===============================================================================
  À NE PAS UTILISER EN PRODUCTION.
  Ces comptes existent pour essayer les rôles sur une instance de test. Sur un
  serveur réel, on crée des comptes nominatifs avec \`pnpm create:admin\`, et on
  supprime ceux-ci. Ce fichier n'est pas versionné (voir .gitignore).
===============================================================================

CONNEXION
  BackOffice : ${baseUrl}/connexion
  Scanner    : ${baseUrl}/scan          (rôle Agent Accueil, ou tout rôle avec scan.use)

${tableau}

DEUX FACTEURS
  Seuls SUPER_ADMIN et ADMIN_FORUM y sont soumis. À la première connexion, ces
  deux comptes sont conduits vers l'écran d'enrôlement : scannez le QR avec une
  application d'authentification (Google Authenticator, FreeOTP, Aegis), puis
  saisissez le code à six chiffres. Les six autres rôles entrent directement.

  Un compte se verrouille quinze minutes après plusieurs échecs. Relancer
  \`pnpm comptes:demo\` remet les compteurs à zéro et fait tourner les mots de
  passe.

RÔLES ET PÉRIMÈTRES

${roles}

ESPACES SANS MOT DE PASSE

  Deux espaces ne s'ouvrent pas par mot de passe mais par un lien à usage unique
  reçu par courriel, valable 30 minutes. En développement, les messages
  n'arrivent pas dans une vraie boîte : ouvrez Mailpit sur http://localhost:8025
  pour lire le lien.

  Espace participant   ${baseUrl}/mon-espace
${
  participant
    ? `      Adresse d'essai : ${participant.email}\n      (${participant.firstName} ${participant.lastName}, badge ${participant.publicId})`
    : "      Aucun participant de démonstration confirmé : lancez `pnpm db:seed`."
}

  Espace intervenant   ${baseUrl}/espace-intervenant
${
  intervenant
    ? `      Adresse d'essai : ${intervenant.email}\n      (${intervenant.firstName} ${intervenant.lastName})`
    : "      Aucun intervenant de démonstration : lancez `pnpm db:seed`."
}

AUTRES COMPTES PRÉSENTS EN BASE

  Non gérés par ce script. À passer en revue avant toute mise en production :
  un compte de démonstration dont le mot de passe est publié, ou un compte
  technique de test, n'ont rien à faire sur un serveur réel.

${
  autres.length === 0
    ? "  Aucun."
    : autres
        .map(
          (compte) =>
            `  ${compte.email.padEnd(32)}${(compte.role.name ?? "").padEnd(24)}` +
            `${compte.totpEnabled ? "2FA active" : "2FA inactive"}`,
        )
        .join("\n")
}

PAR OÙ COMMENCER

  Programme public        ${baseUrl}/programme
  Inscription publique    ${baseUrl}/inscription
  Vérification d'un badge ${baseUrl}/verifier
  Tableau de bord         ${baseUrl}/admin
  Comptoir d'accueil      ${baseUrl}/admin/accueil
  Zones d'accès           ${baseUrl}/admin/zones
  Rapports                ${baseUrl}/admin/rapports
`;

  const sortie = join(process.cwd(), "docs", "comptes.txt");
  await mkdir(dirname(sortie), { recursive: true });
  await writeFile(sortie, contenu, "utf8");

  console.log(`${crees.length} comptes créés ou mis à jour.`);
  console.log(`Identifiants écrits dans ${sortie}`);
}

void main().catch((erreur: unknown) => {
  console.error(erreur);
  process.exit(1);
});
