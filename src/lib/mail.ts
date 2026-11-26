import nodemailer, { type Transporter } from "nodemailer";
import { ENVOIS_PAR_MINUTE } from "./cadence-envoi";

/**
 * Deux boîtes d'envoi, une par nature de courrier (18 novembre 2026).
 *
 * ## Bascule sur Mailjet (19 novembre 2026)
 *
 * Les deux boîtes partaient de comptes **Gmail ordinaires**. Tout ce qui suit a
 * été écrit contre leurs limites, et reste vrai — mais l'envoi passe désormais
 * par **Mailjet** (`in-v3.mailjet.com:587`), avec le domaine `ansd.sn` validé
 * et son SPF mis à jour.
 *
 * Trois choses changent, et une seule compte vraiment :
 *
 * 1. **L'expéditeur est enfin le bon.** Gmail réécrivait le `From` avec
 *    l'adresse authentifiée : les participants lisaient `forumansd@gmail.com`
 *    sur un courrier de l'ANSD. Mailjet, domaine validé, laisse passer
 *    `forum26@ansd.sn`. C'est le gain, et il est visible par tout le monde.
 * 2. **Le plafond n'est plus celui d'une boîte aux lettres** mais celui du plan
 *    souscrit. Les deux voies peuvent donc tenir sur un seul compte ; sans
 *    `SMTP_CAMPAGNE_*`, elles le font déjà (voir `configBoite`).
 * 3. **Les refus de quota ne se présentent plus pareil** — voir
 *    `estRefusQuota` en fin de module, qui ne pouvait pas rester gmail-centré.
 *
 * Ce qui ne change pas : la cadence, le transport mutualisé, le report plutôt
 * que l'acharnement. Ces règles sont nées d'incidents Gmail, mais aucune n'est
 * propre à Gmail — un relais qu'on ménage est un relais qui accepte.
 *
 * Les rebonds, eux, ne se relèvent plus en IMAP pour les envois Mailjet : ils
 * sont traités chez le fournisseur et n'arrivent dans aucune boîte aux lettres
 * (`modules/notifications/rebonds.ts`).
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
 * ## Cinq boîtes depuis le 20 novembre 2026
 *
 * Deux ne suffisaient pas : `registration_confirmed` et `badge_ready`, les deux
 * familles les plus lourdes, partageaient le compteur de la transactionnelle et
 * l'ont épuisé à 12:50 ce jour-là. Le détail des boîtes, de leurs préfixes
 * d'environnement et de ce qu'elles portent est dans `BOITES` ci-dessous.
 *
 * **Qui va où n'est plus décidé ici, ni par l'appelant.** La carte
 * `modèle → boîte` est dans `modules/notifications/boites.ts`, et
 * `sendTemplatedEmail` l'applique. Un modèle ajouté au catalogue sans boîte
 * fait échouer `boites.test.ts` : la question est posée à l'auteur plutôt
 * qu'oubliée.
 */
export type BoiteEnvoi = "transactionnel" | "campagne" | "acces" | "inscription" | "participation";

/**
 * Les boîtes, leur préfixe d'environnement et ce qu'elles portent
 * (20 novembre 2026).
 *
 * ## Pourquoi cinq et non deux
 *
 * Deux boîtes séparaient le **critique à faible volume** du **volumineux**.
 * Cela a tenu une journée : le 20 novembre à 12:50, la boîte transactionnelle
 * a épuisé ses cinq cents envois sur les confirmations et les badges, et les
 * onze messages suivants sont tombés en `550-5.4.5`. La séparation était bonne,
 * son grain était trop grossier — les deux familles les plus lourdes
 * partageaient le même compteur.
 *
 * Cinq comptes, un par famille d'usage, rendent cinq quotas étanches. Ce n'est
 * pas un découpage thématique : c'est une répartition de **volume**, et chaque
 * ligne ci-dessous se lit « ce qui ne doit pas pouvoir assécher le reste ».
 *
 * ## Le préfixe, et le repli
 *
 * Chaque boîte lit `<PRÉFIXE>HOST`, `_PORT`, `_USER`, `_PASSWORD`, `_FROM`.
 * Aucune de ces variables renseignée, la boîte **retombe sur la
 * transactionnelle** : c'est ce qui fait tourner le développement (Mailpit) et
 * un déploiement pas encore migré sans rien changer. Un compte qui n'existe pas
 * encore ne casse donc rien — il n'est simplement pas étanche.
 */
export const BOITES: Record<BoiteEnvoi, { prefixe: string; libelle: string; sert: string }> = {
  transactionnel: {
    prefixe: "SMTP_",
    libelle: "Transactionnelle",
    sert: "codes du BackOffice, presse, contact, délégations",
  },
  campagne: {
    prefixe: "SMTP_CAMPAGNE_",
    libelle: "Campagne",
    sert: "rappels, newsletters, annonces de programme",
  },
  acces: {
    prefixe: "SMTP_ACCES_",
    libelle: "Accès",
    sert: "badges, liens de connexion, espace intervenant",
  },
  inscription: {
    prefixe: "SMTP_INSCRIPTION_",
    libelle: "Inscription",
    sert: "accusés de réception, imports, invitations",
  },
  participation: {
    prefixe: "SMTP_PARTICIPATION_",
    libelle: "Participation",
    sert: "confirmations de participation",
  },
};

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
   *
   * `SMTP_REPLY_TO` passe avant cette déduction, et vaut maintenant pour les
   * **deux** voies (19 novembre 2026). Avec Mailjet, l'expéditeur annoncé est
   * `forum26@ansd.sn` : encore faut-il que quelqu'un relève cette boîte-là. Tant
   * que ce n'est pas le cas, cette variable renvoie les réponses vers une
   * adresse réellement lue, sans toucher au `From` que voient les participants.
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
    replyTo: env.SMTP_REPLY_TO || undefined,
  };

  if (boite === "transactionnel") return transactionnel;

  const prefixe = BOITES[boite].prefixe;

  // Une seule variable suffit à déclarer une boîte : l'hôte, s'il diffère, ou
  // l'identifiant seul quand c'est le même fournisseur — le cas d'un second
  // compte Gmail.
  //
  // Rien de renseigné, la boîte retombe sur la transactionnelle. C'est le
  // réglage du développement (Mailpit) et celui d'un compte pas encore ouvert :
  // le pool partagé (`transport`) fait alors que les deux voies ne rouvrent pas
  // deux fois la même connexion.
  const host = env[`${prefixe}HOST`] || (env[`${prefixe}USER`] ? env.SMTP_HOST : "");
  if (!host) return transactionnel;

  const user = env[`${prefixe}USER`] || undefined;
  // Gmail réécrit le `From` d'un message avec l'adresse authentifiée, sauf
  // alias vérifié : annoncer l'adresse historique depuis une autre boîte
  // donnerait un expéditeur incohérent. Le nom affiché, lui, est repris — les
  // participants doivent voir le même « Forum international sur les données »
  // quelle que soit la boîte qui a porté le message.
  //
  // Un relais à domaine validé (Mailjet) ne réécrit rien : l'identifiant y est
  // une clé d'API, pas une adresse. D'où `<PRÉFIXE>FROM` en premier — une boîte
  // Mailjet doit annoncer `forum26@ansd.sn`, pas sa clé d'API.
  const from =
    env[`${prefixe}FROM`] || (user ? `${nomAffiche(env.SMTP_FROM)} <${user}>`.trim() : undefined);

  return {
    host,
    port: portOuDefaut(env[`${prefixe}PORT`], env.SMTP_PORT),
    user,
    pass: env[`${prefixe}PASSWORD`] || undefined,
    from,
    replyTo: env.SMTP_REPLY_TO || adresseSeule(env.SMTP_FROM) || undefined,
  };
}

/**
 * Compte réellement derrière une boîte (25 novembre 2026).
 *
 * Deux boîtes peuvent retomber sur le **même** compte — une boîte non
 * renseignée replie sur la transactionnelle — et partagent alors un seul
 * quota. Répartir un envoi entre elles comme si elles étaient deux doublerait
 * la charge du compte au lieu de la diviser : la répartition des newsletters
 * raisonne donc par compte, et cette clé est celle du pool de `transport`.
 */
export function compteBoite(
  boite: BoiteEnvoi,
  env: Record<string, string | undefined> = process.env,
): { cle: string; adresse: string } {
  const config = configBoite(boite, env);
  return {
    cle: `${config.host}:${config.port}:${config.user ?? ""}`,
    adresse: adresseSeule(config.from) || config.user || config.host || "non configurée",
  };
}

/**
 * Envois quotidiens permis par le compte d'une boîte, sur vingt-quatre heures
 * glissantes.
 *
 * `<PRÉFIXE>PLAFOND_QUOTIDIEN` l'emporte — la variable que lit déjà
 * `pnpm envois:projection`, transmise au conteneur par
 * `docker-compose.prod.yml`. À défaut, 200 pour Mailjet (le palier gratuit) et
 * 500 ailleurs (la limite d'un compte Gmail ordinaire). Une boîte repliée sur
 * la transactionnelle prend le plafond de celle-ci, puisque c'est son compte
 * qui envoie.
 *
 * Contrairement à la projection, `SMTP_PLAFOND_QUOTIDIEN` ne sert pas de
 * défaut aux autres boîtes : le plafond d'un plan Mailjet payant appliqué à un
 * compte Gmail ferait partir dix fois trop de messages par lui.
 */
export function quotaJourBoite(
  boite: BoiteEnvoi,
  env: Record<string, string | undefined> = process.env,
): number {
  const config = configBoite(boite, env);
  const propre = configBoite("transactionnel", env);
  const repliee =
    boite !== "transactionnel" &&
    config.host === propre.host &&
    config.port === propre.port &&
    config.user === propre.user;
  const prefixe = BOITES[repliee ? "transactionnel" : boite].prefixe;
  const declare = Number(env[`${prefixe}PLAFOND_QUOTIDIEN`]);
  if (Number.isInteger(declare) && declare > 0) return declare;
  if (/mailjet/i.test(config.host)) return 200;
  return 500;
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
 *
 * ## Pourquoi des motifs, et non plus une liste de codes (19 novembre 2026)
 *
 * La version précédente ne connaissait que Gmail, parce que c'était la seule
 * boîte. Depuis la bascule sur Mailjet, elle serait **aveugle** : un refus de
 * quota passerait pour une panne ordinaire, la file brûlerait ses trois
 * tentatives en quinze secondes, et le job mourrait. C'est exactement le défaut
 * du 18 novembre, reconstitué par le changement de fournisseur.
 *
 * Mailjet ne publie pas la liste de ses réponses SMTP de dépassement. Plutôt
 * que d'inventer des codes invérifiables, on reconnaît ce qui est commun à tous
 * les relais : les codes **temporaires** de politique d'envoi, et le
 * vocabulaire du plafond.
 *
 * ## Le piège de l'élargissement
 *
 * « Over quota » désigne aussi, chez beaucoup de serveurs, la boîte **pleine du
 * destinataire** (`552 5.2.2`). Différer six heures pour cela serait faux : ce
 * n'est pas notre quota, et le message doit suivre le cours ordinaire d'un
 * rebond. Les refus qui visent le destinataire sont donc écartés **d'abord** —
 * l'ordre des deux tests est la pièce qui porte la distinction.
 *
 * Même raison pour `4.2.1`, écarté bien qu'il apparaisse chez certains relais
 * sur un dépassement : il sert aussi à dire « boîte du destinataire
 * temporairement désactivée ». Le vocabulaire (« relay limit exceeded ») suffit
 * à rattraper le cas qui nous concerne, sans l'ambiguïté du code nu.
 */

/** Refus qui visent le **destinataire**, jamais notre capacité à envoyer. */
const REFUS_DESTINATAIRE = /\b5\.1\.\d\b|\b5\.2\.2\b|mailbox (is )?full|user unknown/i;

/** Refus qui visent notre **capacité à envoyer** : quota, cadence, bridage. */
const QUOTA_EXPEDITEUR = new RegExp(
  [
    // Gmail, tels que relevés les 17 et 18 novembre 2026.
    "\\b5\\.4\\.5\\b",
    "daily (user )?sending limit",
    // Codes temporaires de politique d'envoi. `4.7.x` couvre le `454-4.7.0` et
    // le `421-4.7.0` de Gmail ; `4.3.2` est le « système n'accepte plus de
    // messages » que renvoie un relais saturé.
    "\\b4\\.7\\.\\d+\\b",
    "\\b4\\.3\\.2\\b",
    // Vocabulaire du plafond, quel que soit le relais.
    "(sending|relay|rate|daily|monthly) limit",
    "quota exceeded",
    "over quota",
    "too many (login attempts|active sessions|messages|emails|recipients)",
    "throttl",
    "upgrade your plan",
  ].join("|"),
  "i",
);

export function estRefusQuota(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (REFUS_DESTINATAIRE.test(message)) return false;
  return QUOTA_EXPEDITEUR.test(message);
}
