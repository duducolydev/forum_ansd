import { type BoiteEnvoi } from "@/lib/mail";
import { CATALOGUE } from "./catalogue";

/**
 * Quelle boîte porte quel modèle (20 novembre 2026).
 *
 * ## Le défaut que cela ferme
 *
 * Le 20 novembre à 12:50, `registration_confirmed` et `badge_ready` ont épuisé
 * ensemble les cinq cents envois quotidiens de la boîte transactionnelle :
 * onze messages refusés en `550-5.4.5`, badges et confirmations compris. Les
 * deux boîtes du 18 novembre séparaient bien le volumineux du critique, mais
 * les deux familles les plus lourdes restaient du même côté du mur.
 *
 * Cinq comptes, cinq quotas étanches (`lib/mail.ts`, `BOITES`). Ce qui suit est
 * la carte, et elle se lit par colonne de droite : chaque boîte rassemble ce
 * qui peut s'assécher ensemble sans empêcher le reste de partir.
 *
 * ## Pourquoi un fichier à part, et non une colonne du catalogue
 *
 * Le catalogue décrit ce qu'un message **contient** — son déclenchement, son
 * destinataire, ses variables. Par quel compte il sort relève de la capacité
 * d'envoi, pas du contenu : la carte bouge quand un compte Gmail est créé ou
 * qu'un plan est souscrit, jamais quand un modèle change de texte. Les deux
 * listes sont tenues séparément et rapprochées par un test
 * (`boites.test.ts`), qui échoue si un modèle du catalogue n'a pas de boîte.
 *
 * ## Les arbitrages, puisqu'ils ne sont pas évidents
 *
 * - `badge_ready` est sur `acces` avec les liens de connexion, comme le veut
 *   la section « Badge et accès » du catalogue. C'est la famille la plus
 *   lourde du lot (un message par inscrit), d'où le déplacement
 *   d'`admin_login_code` décrit juste en dessous.
 * - `admin_login_code` est seul sur la **transactionnelle**, c'est-à-dire
 *   Mailjet. Une trentaine d'envois par jour sur un palier de deux cents, donc
 *   inépuisable — et c'est la seule famille dont la panne enferme l'équipe
 *   dehors de son propre BackOffice. Un code à six chiffres arrivant de
 *   `forum26@ansd.sn` plutôt que d'une adresse `@gmail.com` est en outre plus
 *   crédible pour un message de sécurité.
 * - La presse, le formulaire de contact et les délégations sont sur Mailjet
 *   pour la même raison inverse : faible volume, mais ce sont les
 *   destinataires devant qui un expéditeur `@gmail.com` se voit le plus
 *   (journalistes accrédités, référents de délégations étrangères).
 * - `registration_confirmed` est seul sur `participation` : c'est l'autre
 *   famille à un message par inscrit, et la séparer de `badge_ready` double le
 *   nombre de validations possibles dans une journée.
 */
export const BOITE_PAR_MODELE: Record<string, BoiteEnvoi> = {
  // Accès — badges et liens de connexion des participants.
  badge_ready: "acces",
  magic_link: "acces",
  speaker_link: "acces",

  // Participation — la validation par le comité, à un message par inscrit.
  registration_confirmed: "participation",

  // Inscription — l'entrée dans le Forum, du premier contact à l'accusé.
  invitation: "inscription",
  invitation_reminder: "inscription",
  registration_received: "inscription",
  registration_imported: "inscription",

  // Campagne — tout ce qui part en nombre et qu'on peut différer d'une nuit.
  reminder_j7: "campagne",
  reminder_j1: "campagne",
  newsletter_published: "campagne",
  live_announcement: "campagne",
  thank_you: "campagne",
  session_promoted: "campagne",
  session_updated: "campagne",
  session_updated_speaker: "campagne",
  session_cancelled: "campagne",
  session_cancelled_speaker: "campagne",

  // Transactionnelle (Mailjet) — faible volume, expéditeur du domaine ANSD.
  admin_login_code: "transactionnel",
  accreditation_pending: "transactionnel",
  accreditation_granted: "transactionnel",
  accreditation_declined: "transactionnel",
  contact_message: "transactionnel",
  delegation_referent_assigned: "transactionnel",
  delegation_member_added: "transactionnel",
};

/**
 * La boîte d'un modèle, `transactionnel` par défaut.
 *
 * Le défaut vaut pour un modèle créé en base sans passer par le catalogue : il
 * part par la boîte historique, exactement comme avant ce découpage. Un envoi
 * **en nombre** ne retombe pas là — voir `jobs.ts`, qui préfère la campagne
 * pour ce qu'il ne connaît pas.
 */
export function boitePourModele(templateKey: string): BoiteEnvoi {
  return BOITE_PAR_MODELE[templateKey] ?? "transactionnel";
}

/** Les modèles du catalogue qui n'ont pas de boîte — vide, et le test le vérifie. */
export function modelesSansBoite(): string[] {
  return Object.keys(CATALOGUE).filter((cle) => !BOITE_PAR_MODELE[cle]);
}
