import nodemailer from "nodemailer";
import { ENVOIS_PAR_MINUTE } from "./cadence-envoi";

/**
 * Transport SMTP **mutualisé** (17 novembre 2026).
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
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
  pool: true,
  maxConnections: 1,
  maxMessages: 100,
  rateDelta: 60_000,
  rateLimit: ENVOIS_PAR_MINUTE,
});

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Adresse de réponse : l'expéditeur d'un message du formulaire de contact. */
  replyTo?: string;
}

/**
 * Envoi bas niveau (SMTP). La composition à partir de `NotificationTemplate`,
 * la mise en file (jamais d'envoi synchrone, brief §3.3) et l'écriture dans
 * `NotificationLog` relèvent du module `modules/notifications` (PLAN.md 3.8).
 */
export async function sendMail(input: SendMailInput) {
  return transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
}
