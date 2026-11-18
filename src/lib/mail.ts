import nodemailer, { type Transporter } from "nodemailer";
import { ENVOIS_PAR_MINUTE } from "./cadence-envoi";

/**
 * Deux boîtes d'envoi, une par nature de courrier (18 novembre 2026).
 *
 * ## Le défaut que cela ferme
 *
 * Le 18 novembre au matin, les confirmations d'inscription et les badges
 * étaient refusés en bloc : `550-5.4.5 Daily user sending limit exceeded`. Les
 * rappels J-7 partis dans la nuit — un peu moins de trois cents — avaient
 * consommé le quota journalier du compte, et il ne restait rien pour le reste.
 *
 * Distinguer ce mur de celui de la veille. Le 17 novembre, c'était
 * `454-4.7.0 Too many login attempts` : un quota de **connexions**, fermé par
 * le transport mutualisé ci-dessous. Celui-ci est un quota de **volume**, et
 * aucun réglage de transport n'y peut rien : la boîte du Forum est un compte
 * Gmail ordinaire, plafonné à cinq cents destinataires par tranche de
 * vingt-quatre heures glissantes.
 *
 * ## Pourquoi deux boîtes plutôt qu'un rationnement
 *
 * Une seule boîte, même rationnée, reste un vase commun : il faut arbitrer en
 * permanence entre une campagne et le reste, et l'arbitrage se trompe. Deux
 * comptes distincts rendent les quotas **étanches** — une campagne de rappels
 * ne peut plus, par construction, empêcher une confirmation de partir.
 *
 * Ce qui est en jeu dépasse les confirmations. Les codes à six chiffres du
 * BackOffice (`modules/auth/deuxieme-facteur.ts`) et les liens de connexion
 * (`magic-link.ts`) passent par la même file : quota épuisé, **plus personne ne
 * se connecte**. Le 23 novembre au matin, jour d'ouverture, cela voudrait dire
 * des agents d'accueil devant un écran de connexion muet.
 *
 * - `transactionnel` : tout ce qui part à une personne à la fois et qu'elle
 *   attend — codes de connexion, confirmations, badges, accusés de contact.
 *   C'est la boîte historique (`SMTP_*`), et le défaut.
 * - `campagne` : les envois en nombre — rappels J-7 et J-1, invitations,
 *   envois groupés du BackOffice (`SMTP_CAMPAGNE_*`).
 *
 * Sans `SMTP_CAMPAGNE_*`, les deux voies retombent sur la boîte historique :
 * le développement (Mailpit) et un déploiement pas encore migré continuent de
 * fonctionner sans rien changer.
 */
export type BoiteEnvoi = "transactionnel" | "campagne";

export interface ConfigBoite {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  /** En-tête `From` complet, nom affiché compris. */
  from?: string;
  /**
   * Adresse de réponse par défaut.
   *
   * La boîte de campagne n'est relevée par personne : une réponse à un rappel
   * J-1 y serait perdue. Elle est donc renvoyée vers la boîte historique, que
   * l'équipe consulte déjà.
   */
  replyTo?: string;
}

/**
 * Premier port réellement renseigné, sinon 587.
 *
 * ## Pourquoi pas `Number(env.SMTP_CAMPAGNE_PORT ?? env.SMTP_PORT ?? 587)`
 *
 * Parce que `??` ne rattrape que `null` et `undefined`, et qu'une variable non
 * renseignée n'arrive pas absente : `docker-compose.prod.yml` l'écrit
 * `${SMTP_CAMPAGNE_PORT:-}`, c'est-à-dire une chaîne **vide**. `??` la laisse
 * donc passer, et `Number("")` vaut **zéro**.
 *
 * Constaté le 18 novembre 2026 en production, où `boites:verifier` affichait
 * « smtp.gmail.com:0 » pour la boîte de campagne. L'envoi marchait quand même —
 * nodemailer voit un port falsy et retombe sur son propre défaut — ce qui est
 * le pire des cas : un réglage faux que rien ne signale, et qui aurait mordu le
 * jour où la boîte de campagne aurait eu besoin d'un autre port que 587.
 */
function portOuDefaut(...valeurs: (string | undefined)[]): number {
  for (const valeur of valeurs) {
    if (!valeur?.trim()) continue;
    const nombre = Number(valeur);
    if (Number.isInteger(nombre) && nombre > 0) return nombre;
  }
  return 587;
}

/** Nom affiché d'un en-tête `From` (`Forum <forum@…>` → `Forum`). */
function nomAffiche(from: string | undefined): string {
  const avant = from?.split("<")[0]?.trim() ?? "";
  return avant.replace(/^"|"$/g, "");
}

/** Adresse seule d'un en-tête `From` (`Forum <forum@…>` → `forum@…`). */
function adresseSeule(from: string | undefined): string {
  const entre = from?.match(/<([^>]+)>/)?.[1];
  return (entre ?? from ?? "").trim();
}

/**
 * Configuration d'une boîte, déduite de l'environnement.
 *
 * Pure et exportée pour cela : le repli de la campagne sur la boîte historique
 * est la pièce qui doit être vérifiée sans ouvrir de connexion SMTP.
 */
export function configBoite(
  boite: BoiteEnvoi,
  env: Record<string, string | undefined> = process.env,
): ConfigBoite {
  const transactionnel: ConfigBoite = {
    host: env.SMTP_HOST ?? "",
    port: portOuDefaut(env.SMTP_PORT),
    user: env.SMTP_USER || undefined,
    pass: env.SMTP_PASSWORD || undefined,
    from: env.SMTP_FROM,
  };

  if (boite === "transactionnel") return transactionnel;

  // Une seule variable suffit à déclarer la seconde boîte : l'hôte, s'il
  // diffère, ou l'identifiant seul quand c'est le même fournisseur — le cas
  // d'un second compte Gmail.
  const host = env.SMTP_CAMPAGNE_HOST || (env.SMTP_CAMPAGNE_USER ? env.SMTP_HOST : "");
  if (!host) return transactionnel;

  const user = env.SMTP_CAMPAGNE_USER || undefined;
  // Gmail réécrit le `From` d'un message avec l'adresse authentifiée, sauf
  // alias vérifié : annoncer l'adresse historique depuis le compte de campagne
  // donnerait un expéditeur incohérent. Le nom affiché, lui, est repris — les
  // participants doivent voir le même « Forum international sur les données ».
  const from =
    env.SMTP_CAMPAGNE_FROM || (user ? `${nomAffiche(env.SMTP_FROM)} <${user}>`.trim() : undefined);

  return {
    host,
    port: portOuDefaut(env.SMTP_CAMPAGNE_PORT, env.SMTP_PORT),
    user,
    pass: env.SMTP_CAMPAGNE_PASSWORD || undefined,
    from,
    replyTo: adresseSeule(env.SMTP_FROM) || undefined,
  };
}

/**
 * Transport SMTP **mutualisé**, un par boîte (17 novembre 2026).
 *
 * ## Le défaut que cela ferme
 *
 * Sans `pool`, nodemailer ouvre une connexion — donc une **authentification** —
 * pour chaque message, et la referme aussitôt. Tant qu'on envoie un courriel de
 * temps en temps, cela ne se voit pas. Sur une campagne, c'est une rafale de
 * connexions : Google en a compté 273 en deux minutes et a fermé le robinet —
 * `454-4.7.0 Too many login attempts, please try again later`. 80 rappels J-7
 * partis, 193 refusés.
 *
 * Noter ce que disait le message : « login attempts », pas « messages ». Ce
 * n'était pas un quota de volume mais de **connexions**, et c'est pourquoi la
 * seule cadence ne suffisait pas à l'éviter.
 *
 * ## Les réglages, un par un
 *
 * - `pool` : une connexion authentifiée, réutilisée. C'est le correctif.
 * - `maxConnections: 1` : le worker traite un job à la fois, une connexion
 *   suffit — et Gmail supporte mal les connexions parallèles d'un même compte.
 * - `maxMessages` : la connexion est recyclée au bout de cent messages. Gmail
 *   ferme de toute façon les sessions longues ; mieux vaut en reprendre une
 *   proprement que de découvrir la coupure au message suivant.
 * - `rateDelta`/`rateLimit` : plafond de sécurité au niveau du transport, à la
 *   même cadence que les campagnes (`lib/cadence-envoi.ts`). La cadence des
 *   campagnes protège la boîte ; ce plafond-ci protège aussi de tout ce qui
 *   n'est pas une campagne — un pic d'inscriptions, un rattrapage de file.
 *
 * Construction **paresseuse** et mémorisée : les deux transports ouvriraient
 * sinon deux pools à l'import du module, y compris dans les scripts et les
 * tests qui n'envoient rien.
 */
const transports = new Map<string, Transporter>();

function transport(boite: BoiteEnvoi): { transporter: Transporter; config: ConfigBoite } {
  const config = configBoite(boite);
  // Clé sur la configuration résolue, pas sur la voie : sans `SMTP_CAMPAGNE_*`
  // les deux voies partagent la même boîte, et doivent partager le même pool —
  // deux pools sur un même compte Gmail, c'est le quota de connexions à
  // nouveau.
  const cle = `${config.host}:${config.port}:${config.user ?? ""}`;

  let transporter = transports.get(cle);
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      pool: true,
      maxConnections: 1,
      maxMessages: 100,
      rateDelta: 60_000,
      rateLimit: ENVOIS_PAR_MINUTE,
    });
    transports.set(cle, transporter);
  }
  return { transporter, config };
}

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Adresse de réponse : l'expéditeur d'un message du formulaire de contact. */
  replyTo?: string;
  /** Boîte d'envoi. Par défaut `transactionnel` — voir l'en-tête du module. */
  boite?: BoiteEnvoi;
}

/**
 * Envoi bas niveau (SMTP). La composition à partir de `NotificationTemplate`,
 * la mise en file (jamais d'envoi synchrone, brief §3.3) et l'écriture dans
 * `NotificationLog` relèvent du module `modules/notifications` (PLAN.md 3.8).
 */
export async function sendMail(input: SendMailInput) {
  const { transporter, config } = transport(input.boite ?? "transactionnel");
  return transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo ?? config.replyTo,
  });
}

/**
 * Le serveur a-t-il refusé **faute de quota**, par opposition à une panne ?
 *
 * Un refus de quota ne se retente pas dans la seconde. Les trois tentatives de
 * la file (`lib/queue`) tombaient en quinze secondes, échouaient toutes les
 * trois, et consommaient du quota à chaque fois : le 18 novembre, 764 lignes en
 * échec pour environ 250 messages réels. Reconnaître ce refus permet de
 * **différer** au lieu de s'acharner (`modules/notifications/jobs.ts`).
 *
 * Les codes retenus, tels que Gmail les renvoie :
 * - `550-5.4.5 Daily user sending limit exceeded` — quota journalier atteint ;
 * - `454-4.7.0 Too many login attempts` — quota de connexions ;
 * - `421-4.7.0 Try again later` — bridage temporaire.
 */
export function estRefusQuota(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\b5\.4\.5\b/.test(message) ||
    /\b4\.7\.0\b/.test(message) ||
    /daily (user )?sending limit/i.test(message) ||
    /too many login attempts/i.test(message)
  );
}
