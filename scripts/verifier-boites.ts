import "dotenv/config";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { configBoite, type BoiteEnvoi, type ConfigBoite } from "../src/lib/mail";
import { configsImap } from "../src/modules/notifications/rebonds";

/**
 * Vérifie les boîtes d'envoi avant de compter dessus (18 novembre 2026).
 *
 *     docker compose -f docker-compose.prod.yml run --rm outils pnpm boites:verifier
 *     docker compose -f docker-compose.prod.yml run --rm outils pnpm boites:verifier moi@ansd.sn
 *
 * ## Pourquoi ce script
 *
 * Les envois en nombre partent désormais d'un second compte (`src/lib/mail.ts`).
 * Un compte **neuf** réserve trois surprises qu'on ne veut pas découvrir au
 * moment où trois cents rappels J-1 se déclenchent un dimanche matin :
 *
 * 1. le mot de passe d'application est mal recopié — Gmail les affiche par
 *    groupes de quatre lettres, et les espaces se collent au passage ;
 * 2. l'IMAP n'est pas activé sur le nouveau compte, et le relevé des rebonds
 *    reste muet sur la moitié des envois ;
 * 3. la variable est bien dans le `.env` mais pas dans le conteneur — le piège
 *    documenté au §4 du guide de déploiement, où Compose répond « Running » au
 *    lieu de « Recreated ».
 *
 * Avec une adresse en argument, un message d'essai part de **chaque** boîte :
 * c'est la seule façon de voir ce que le destinataire verra, nom affiché et
 * adresse de réponse compris.
 *
 * ## Depuis la bascule sur Mailjet (19 novembre 2026)
 *
 * Le script ne connaît aucun fournisseur : il lit `configBoite` et ouvre ce
 * qu'on lui a déclaré. Trois nuances pour lire sa sortie :
 *
 * - la première surprise ci-dessus disparaît (l'identifiant est une clé d'API),
 *   la troisième reste entière — c'est même la plus probable un jour de
 *   bascule ;
 * - **« IMAP non configuré » n'est plus une anomalie** : Mailjet traite ses
 *   rebonds chez lui, et il n'y a rien à relever (`notifications/rebonds.ts`) ;
 * - une seule boîte au lieu de deux est le réglage attendu, un seul plan
 *   portant les deux voies.
 *
 * C'est aussi l'outil de l'essai mail-tester : lui passer l'adresse jetable de
 * <https://www.mail-tester.com> envoie depuis l'IP réelle du serveur, seule
 * façon de noter SPF, DKIM et réputation (README, « Noter la délivrabilité »).
 *
 * ## Ce que ce script n'affiche jamais
 *
 * Aucun mot de passe, pas même tronqué. Il dit si l'authentification passe,
 * ce qui est la seule chose utile.
 */

const destinataire = process.argv[2];

const VOIES: { boite: BoiteEnvoi; libelle: string; sert: string }[] = [
  {
    boite: "transactionnel",
    libelle: "Transactionnelle",
    sert: "codes de connexion, confirmations, badges",
  },
  { boite: "campagne", libelle: "Campagne", sert: "rappels, invitations, envois groupés" },
];

function masquer(adresse: string | undefined): string {
  return adresse || "(non renseignée)";
}

async function verifierSmtp(config: ConfigBoite): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  try {
    await transporter.verify();
  } finally {
    transporter.close();
  }
}

async function envoyerEssai(config: ConfigBoite, a: string, libelle: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: false,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  try {
    await transporter.sendMail({
      from: config.from,
      to: a,
      replyTo: config.replyTo,
      subject: `[Essai] Boîte ${libelle} du portail du Forum`,
      text:
        `Message d'essai envoyé par scripts/verifier-boites.ts.\n\n` +
        `Boîte : ${libelle}\n` +
        `Expéditeur annoncé : ${masquer(config.from)}\n` +
        `Réponses vers : ${masquer(config.replyTo ?? config.from)}\n\n` +
        `Si vous lisez ceci, cette boîte fonctionne.`,
    });
  } finally {
    transporter.close();
  }
}

async function principal(): Promise<void> {
  let echecs = 0;

  const transactionnel = configBoite("transactionnel");
  const campagne = configBoite("campagne");
  const partagees = transactionnel.user === campagne.user && transactionnel.host === campagne.host;

  console.log("Boîtes d'envoi\n");

  for (const voie of VOIES) {
    const config = configBoite(voie.boite);
    console.log(`  ${voie.libelle} — ${voie.sert}`);
    console.log(`    hôte      ${config.host}:${config.port}`);
    console.log(`    compte    ${masquer(config.user)}`);
    console.log(`    expéditeur ${masquer(config.from)}`);
    if (config.replyTo) console.log(`    réponses  ${config.replyTo}`);

    if (voie.boite === "campagne" && partagees) {
      console.log(
        "    ! SMTP_CAMPAGNE_* absentes : les campagnes repartent sur la boîte\n" +
          "      transactionnelle. Les quotas ne sont pas étanches.",
      );
    }

    try {
      await verifierSmtp(config);
      console.log("    SMTP      authentification acceptée");
    } catch (error) {
      echecs += 1;
      console.log(`    SMTP      ÉCHEC — ${error instanceof Error ? error.message : error}`);
    }
    console.log("");
  }

  console.log("Relevé des rebonds (IMAP)\n");
  const imaps = configsImap();

  /*
   * Dire **quelle boîte n'est pas relevée**, et non pas seulement lister celles
   * qui le sont.
   *
   * Le relevé ne déduit l'IMAP que des fournisseurs qu'il connaît. Une boîte
   * servie par un fournisseur qu'il ne reconnaît pas disparaissait donc
   * silencieusement de la liste : ses avis de non-distribution cessaient
   * d'alimenter l'historique sans que rien ne le signale — un réglage faux que
   * rien ne dit, exactement ce qu'on cherche à éviter partout ailleurs.
   *
   * Le cas se présente avec Microsoft 365 (18 novembre 2026) : l'envoi par
   * SMTP AUTH y fonctionne avec un mot de passe, mais l'IMAP non — Microsoft a
   * retiré l'authentification basique de l'IMAP en 2022, et n'accepte plus que
   * OAuth 2.0. Les avis arrivent bien dans la boîte ; c'est leur relevé
   * automatique qui n'est pas possible.
   */
  const releves = new Set(imaps.map((imap) => imap.user));
  for (const voie of VOIES) {
    if (voie.boite === "campagne" && partagees) continue;
    const config = configBoite(voie.boite);
    if (!config.user || releves.has(config.user)) continue;
    console.log(`  ${config.user} — PAS DE RELEVÉ AUTOMATIQUE`);
    console.log("      Les avis « adresse introuvable » de cette boîte n'alimenteront pas");
    console.log("      l'historique d'envoi. Ils y arrivent quand même : les consulter");
    console.log("      directement dans la boîte (Outlook, webmail).");
    console.log("      Microsoft 365 : l'IMAP par mot de passe n'existe plus (OAuth seulement).");
    console.log("");
  }

  if (imaps.length === 0) {
    console.log("  Aucune boîte lisible : les rebonds différés ne seront pas reportés.\n");
  }
  for (const imap of imaps) {
    const client = new ImapFlow({
      host: imap.host,
      port: imap.port,
      secure: imap.port === 993,
      auth: { user: imap.user, pass: imap.pass },
      logger: false,
    });
    try {
      await client.connect();
      await client.logout();
      console.log(`  ${imap.user} — connexion acceptée`);
    } catch (error) {
      echecs += 1;
      console.log(
        `  ${imap.user} — ÉCHEC : ${error instanceof Error ? error.message : error}\n` +
          "    Activer IMAP sur ce compte (Gmail → Paramètres → Transfert et POP/IMAP).",
      );
    }
  }
  console.log("");

  if (destinataire) {
    console.log(`Messages d'essai vers ${destinataire}\n`);
    for (const voie of VOIES) {
      if (voie.boite === "campagne" && partagees) continue;
      try {
        await envoyerEssai(configBoite(voie.boite), destinataire, voie.libelle);
        console.log(`  ${voie.libelle} — parti`);
      } catch (error) {
        echecs += 1;
        console.log(
          `  ${voie.libelle} — ÉCHEC : ${error instanceof Error ? error.message : error}`,
        );
      }
    }
    console.log("");
  } else {
    console.log(
      "Ajouter une adresse en argument pour recevoir un message d'essai de chaque boîte.\n",
    );
  }

  if (echecs > 0) {
    console.error(`${echecs} vérification(s) en échec.`);
    process.exitCode = 1;
  } else {
    console.log("Tout est en ordre.");
  }
}

void principal();
