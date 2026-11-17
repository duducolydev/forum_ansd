/**
 * Cadence des campagnes de courriels (PLAN.md §22, étendu le 17 novembre 2026).
 *
 * ## Pourquoi une cadence
 *
 * Une campagne met un message en file **par destinataire**. Sans cadence, mille
 * messages partent en quelques secondes : une boîte d'envoi ordinaire — celle
 * du Forum est un compte Gmail — coupe alors le robinet, et les suivants sont
 * refusés en bloc, sans qu'on sache lesquels sont passés.
 *
 * ## Pourquoi ce module est partagé
 *
 * La règle était écrite dans le module des **invitations**, et elle y est née
 * d'un incident. L'envoi groupé de notifications, écrit plus tard, ne l'a
 * jamais reprise : le 17 novembre 2026, un rappel J-7 à 273 personnes est parti
 * d'un seul coup. Gmail a accepté 80 messages puis a refusé les 193 autres —
 * `454-4.7.0 Too many login attempts`. Une leçon tirée dans un module ne
 * protège pas le module d'à côté ; elle doit vivre à un endroit que les deux
 * importent.
 *
 * La cadence ne suffit pas à elle seule : c'est le **nombre de connexions** que
 * Google comptait, pas le nombre de messages. Le transport SMTP est donc
 * mutualisé par ailleurs (`lib/mail.ts`). Les deux vont ensemble — l'un espace
 * les envois, l'autre évite de se réauthentifier à chaque message.
 *
 * Module pur, sans dépendance : il sert aux services comme aux tests.
 */

/**
 * Vingt par minute : assez lent pour ne pas ressembler à une rafale, assez
 * rapide pour écouler un millier de messages en moins d'une heure.
 */
export const ENVOIS_PAR_MINUTE = 20;

/**
 * Moment d'envoi du n-ième message d'une campagne.
 *
 * Fonction pure, et exportée pour cela : c'est l'étalement qui protège la boîte
 * d'envoi, et il se vérifie sans file ni base.
 */
export function momentEnvoi(index: number, depart: Date): Date {
  return new Date(depart.getTime() + Math.round((index * 60_000) / ENVOIS_PAR_MINUTE));
}

/** Durée d'écoulement d'une campagne, en minutes, arrondie au supérieur. */
export function dureeCampagneMinutes(nombre: number): number {
  return nombre <= 1 ? 0 : Math.ceil((nombre - 1) / ENVOIS_PAR_MINUTE);
}
