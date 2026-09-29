import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueNotification } from "@/modules/notifications/jobs";
import { parametresFrais } from "@/modules/settings/service";

/**
 * Formulaire de contact du site (29 septembre 2026) : le visiteur écrit au
 * comité sans ouvrir sa messagerie. Le message part vers l'adresse réglée en
 * BackOffice (Paramètres → Pied de page, « Réception du formulaire de
 * contact », par défaut forumansd@gmail.com), avec l'adresse du visiteur en
 * **Reply-To** : répondre depuis la boîte du Forum lui écrit directement.
 *
 * Garde-fous :
 * - envoi par la file de jobs, jamais pendant la requête (brief §3.3) ;
 * - objet ramené sur une ligne : pas d'en-tête injecté par un saut de ligne ;
 * - limites par adresse IP et par adresse e-mail ;
 * - **aucun accusé de réception** au visiteur : le formulaire ne doit pas
 *   pouvoir servir à envoyer un message du Forum à une adresse quelconque.
 */

export const messageContactSchema = z.object({
  nom: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.email("Adresse e-mail invalide.").trim().max(190),
  organisation: z.string().trim().max(150).optional().or(z.literal("")),
  objet: z
    .string()
    .trim()
    .min(3, "Indiquez l'objet de votre message.")
    .max(150)
    .transform((valeur) => valeur.replace(/[\r\n]+/g, " ")),
  message: z
    .string()
    .trim()
    .min(10, "Votre message est trop court.")
    .max(4000, "Votre message est trop long (4 000 caractères au plus)."),
});

export type MessageContact = z.infer<typeof messageContactSchema>;

const PAR_IP_PAR_HEURE = 5;
const PAR_ADRESSE_PAR_HEURE = 3;
const UNE_HEURE = 60 * 60;

export type ResultatContact =
  { status: "ENVOYE" } | { status: "LIMITE"; retryAfterSeconds: number };

export async function envoyerMessageContact(
  message: MessageContact,
  ip: string,
): Promise<ResultatContact> {
  for (const [cle, plafond] of [
    [`contact:ip:${ip}`, PAR_IP_PAR_HEURE],
    [`contact:email:${message.email.toLowerCase()}`, PAR_ADRESSE_PAR_HEURE],
  ] as const) {
    const limite = await rateLimit(cle, plafond, UNE_HEURE);
    if (!limite.allowed) return { status: "LIMITE", retryAfterSeconds: limite.retryAfterSeconds };
  }

  const { edition, parametres } = await parametresFrais();
  await enqueueNotification(
    {
      editionId: edition.id,
      templateKey: "contact_message",
      to: parametres.piedDePage.destinataireContact,
      replyTo: message.email,
      variables: {
        nom: message.nom,
        email: message.email,
        organisation: message.organisation || "—",
        objet: message.objet,
        message: message.message,
      },
    },
    `contact-${crypto.randomUUID()}`,
  );
  return { status: "ENVOYE" };
}
