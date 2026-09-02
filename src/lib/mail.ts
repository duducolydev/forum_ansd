import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
});

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
  });
}
