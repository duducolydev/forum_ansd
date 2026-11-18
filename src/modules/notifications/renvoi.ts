import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { momentEnvoi } from "@/lib/cadence-envoi";
import { variablesAccesDirect } from "@/modules/auth/acces-direct";
import { CATALOGUE, VARIABLES_PARTICIPANT } from "./catalogue";
import { VARIABLES_PROGRAMME } from "./recap-programme";
import { envoyerConfirmation } from "@/modules/participants/service";
import type { Actor } from "@/modules/participants/service";
import { enqueueNotification } from "./jobs";

/**
 * Renvoi des envois restés en échec (18 novembre 2026).
 *
 * ## Ce que cela rattrape
 *
 * Le matin du 18 novembre, le quota journalier de la boîte Gmail est tombé sur
 * les confirmations d'inscription et les badges : environ 250 messages refusés,
 * trois tentatives chacun en quinze secondes, puis plus rien. Les destinataires
 * n'ont jamais reçu leur badge, et aucun écran ne permettait de le réparer
 * autrement qu'en régénérant les badges un par un.
 *
 * Les deux boîtes séparées (`lib/mail.ts`) empêchent que cela se reproduise.
 * Celui-ci répare ce qui est déjà perdu.
 *
 * ## Pourquoi ne pas simplement rejouer le journal
 *
 * Parce que `NotificationLog` ne garde pas les variables du message, et que
 * les deux modèles concernés portent justement ce qui ne peut pas être
 * reconstitué de mémoire : `badge_ready` contient un lien **signé** vers
 * l'espace, `registration_confirmed` un lien signé **et** un code de secours à
 * six chiffres. Rejouer la ligne du journal enverrait un message où
 * `{{code6}}` apparaîtrait tel quel.
 *
 * Chaque famille repasse donc par l'émetteur d'origine, qui refabrique un lien
 * neuf. Un lien signé a une durée de vie : celui d'un renvoi doit courir à
 * partir d'aujourd'hui, pas de l'échec.
 */

/**
 * Modèles qu'on ne renvoie **jamais**, quoi qu'en dise le catalogue.
 *
 * Un lien de connexion ou un code à six chiffres est périmé par nature :
 * renvoyer celui d'hier n'aide personne, et prolonge un secret qui aurait dû
 * mourir. Qu'on puisse en refabriquer un neuf ne change rien — ce n'est pas au
 * rattrapage d'un incident d'envoi d'ouvrir des accès.
 */
const JAMAIS_RENVOYES = new Set(["admin_login_code", "magic_link", "speaker_link"]);

/** Modèles dont la confirmation d'inscription refabrique les variables. */
const CONFIRMATIONS: Record<string, { importe: boolean }> = {
  registration_confirmed: { importe: false },
  registration_imported: { importe: true },
  accreditation_granted: { importe: false },
};

/**
 * Ce modèle peut-il être renvoyé à partir du seul journal ?
 *
 * ## Le piège
 *
 * `NotificationLog` ne garde pas les variables du message. Remettre en file
 * avec des variables vides suppose donc que le modèle n'en demande aucune que
 * l'envoi ne sache refabriquer — sans quoi le destinataire recevrait un
 * message où `{{code6}}` ou `{{lien_inscription}}` apparaîtrait tel quel.
 *
 * ## Qui décide
 *
 * Le catalogue (`catalogue.ts`), et non une liste tenue ici. Il déclare, modèle
 * par modèle, ce que l'émetteur fournit en propre ; `sendTemplatedEmail`
 * réinjecte d'office les variables communes d'un participant
 * (`VARIABLES_PARTICIPANT`) et résout celles du programme à l'envoi
 * (`VARIABLES_PROGRAMME`). Un modèle est donc renvoyable quand il ne demande
 * **rien d'autre** que ces deux ensembles.
 *
 * L'intérêt est qu'un modèle ajouté demain avec une variable propre sera exclu
 * tout seul, sans que personne ait à y penser. Un modèle inconnu du catalogue
 * l'est aussi : on ne devine pas ce qu'il attend.
 */
const REFABRIQUEES = new Set<string>([...VARIABLES_PARTICIPANT, ...VARIABLES_PROGRAMME]);

function renvoyableTelQuel(templateKey: string): boolean {
  const entree = CATALOGUE[templateKey];
  // `destinataire: "autre"` ne reçoit aucune variable commune : même un modèle
  // qui n'en déclare pas en propre partirait amputé.
  if (!entree || entree.destinataire !== "participant") return false;
  return entree.variables.every((nom) => REFABRIQUEES.has(nom));
}

/** Le renvoi sait-il reproduire ce message ? Exporté pour être vérifié seul. */
export function estRenvoyable(templateKey: string): boolean {
  if (JAMAIS_RENVOYES.has(templateKey)) return false;
  if (CONFIRMATIONS[templateKey] || templateKey === "badge_ready") return true;
  return renvoyableTelQuel(templateKey);
}

export interface CandidatRenvoi {
  participantId: string;
  templateKey: string;
  to: string;
}

export interface BilanRenvoi {
  remis: number;
  /** Modèles non renvoyables (codes de connexion, invitations) rencontrés en chemin. */
  ignores: number;
  /** Adresses que le serveur distant déclare inexistantes : à corriger, pas à renvoyer. */
  adressesMortes: number;
}

/**
 * Le serveur distant a-t-il refusé l'**adresse**, et non l'envoi ?
 *
 * `5.1.1` veut dire « ce compte n'existe pas ». Le renvoyer échouera à
 * l'identique et consommera du quota pour rien. Relevé le 18 novembre 2026
 * dans l'historique, parmi les refus de quota : une inscription saisie avec une
 * adresse fautive produit la même ligne « Échec » qu'une panne d'envoi, alors
 * que seule la première demande une correction humaine.
 *
 * À distinguer du rebond différé (`BOUNCED`), où Gmail accepte puis le serveur
 * du destinataire refuse après coup : celui-là est déjà écarté par `servis`.
 */
export function adresseMorte(erreur: string | null): boolean {
  if (!erreur) return false;
  return (
    /\b5\.1\.1\b/.test(erreur) ||
    /\b5\.1\.3\b/.test(erreur) ||
    /nosuchuser/i.test(erreur) ||
    /user unknown|recipient (address )?rejected|does not exist/i.test(erreur)
  );
}

/**
 * Les échecs qui méritent un renvoi, dédoublonnés.
 *
 * Trois filtres, et chacun a sa raison :
 *
 * - **un seul renvoi par personne et par modèle** : les trois tentatives de la
 *   file ont laissé trois lignes identiques. Sans ce dédoublonnage, Babacar
 *   DIOUF recevrait trois fois son badge ;
 * - **rien si le message est finalement parti** : une ligne `SENT` pour le même
 *   couple signifie qu'une tentative ultérieure a réussi ;
 * - **rien si l'adresse a rebondi** : `BOUNCED`, c'est le serveur du
 *   destinataire qui refuse l'adresse. Renvoyer n'y changera rien ; il faut
 *   corriger l'adresse, ce que l'historique propose déjà.
 */
export async function echecsARenvoyer(
  editionId: string,
): Promise<{ candidats: CandidatRenvoi[]; adressesMortes: number }> {
  const lignes = await prisma.notificationLog.findMany({
    where: {
      status: "FAILED",
      channel: "EMAIL",
      participantId: { not: null },
      participant: { editionId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: { participantId: true, templateKey: true, to: true, error: true },
  });
  if (lignes.length === 0) return { candidats: [], adressesMortes: 0 };

  // Les couples déjà servis — ou dont l'adresse est morte — sont écartés en une
  // seule lecture plutôt qu'une par candidat.
  const aboutis = await prisma.notificationLog.findMany({
    where: {
      status: { in: ["SENT", "BOUNCED"] },
      participantId: { in: [...new Set(lignes.map((ligne) => ligne.participantId!))] },
    },
    select: { participantId: true, templateKey: true },
  });
  const servis = new Set(aboutis.map((ligne) => `${ligne.participantId}:${ligne.templateKey}`));

  const vus = new Set<string>();
  const candidats: CandidatRenvoi[] = [];
  let adressesMortes = 0;
  for (const ligne of lignes) {
    const cle = `${ligne.participantId}:${ligne.templateKey}`;
    if (servis.has(cle) || vus.has(cle)) continue;
    vus.add(cle);
    // La ligne la plus récente fait foi : c'est elle qui porte la dernière
    // raison connue, et les tentatives d'un même envoi échouent toutes pour
    // le même motif.
    if (adresseMorte(ligne.error)) {
      adressesMortes += 1;
      continue;
    }
    candidats.push({
      participantId: ligne.participantId!,
      templateKey: ligne.templateKey,
      to: ligne.to,
    });
  }
  return { candidats, adressesMortes };
}

/** Combien d'envois le bouton de l'historique remettrait en file. */
export async function compterEchecsARenvoyer(editionId: string): Promise<number> {
  const { candidats } = await echecsARenvoyer(editionId);
  return candidats.filter((candidat) => estRenvoyable(candidat.templateKey)).length;
}

/**
 * Remet en file les envois restés en échec.
 *
 * Étalés à la cadence des campagnes (`lib/cadence-envoi.ts`) : un rattrapage
 * de deux cent cinquante messages est une campagne, quoi qu'en dise son nom,
 * et rien ne serait plus absurde que de rouvrir le quota en le refermant
 * aussitôt.
 *
 * ## Boîte de campagne, et non transactionnelle
 *
 * Ce module routait d'abord le rattrapage vers la boîte transactionnelle, au
 * motif que ce sont des messages que quelqu'un attend. L'incident du
 * 18 novembre 2026 a montré que le raisonnement était faux.
 *
 * Ce qui distingue les deux voies n'est pas l'impatience du destinataire mais
 * le **volume** : la boîte transactionnelle doit rester libre pour le trafic
 * vivant — une inscription qui arrive à l'instant, un code de connexion
 * demandé là, maintenant. Un rattrapage de deux cent cinquante messages est un
 * envoi en nombre, et le faire passer par la voie transactionnelle revient à
 * écraser les inscriptions du jour sous les échecs de la veille — exactement
 * le défaut que la séparation des boîtes était censée fermer.
 *
 * Le rattrapage part donc de la boîte de campagne, étalé à la cadence des
 * campagnes (`lib/cadence-envoi.ts`).
 */
export async function renvoyerEchecs(editionId: string, actor: Actor): Promise<BilanRenvoi> {
  const { candidats, adressesMortes } = await echecsARenvoyer(editionId);
  const depart = new Date();
  const bilan: BilanRenvoi = { remis: 0, ignores: 0, adressesMortes };
  // Horodatage commun à toutes les clés d'idempotence de ce rattrapage : deux
  // clics successifs ne doublent pas les messages dans la minute, alors qu'un
  // rattrapage décidé plus tard reste possible.
  const lot = depart.toISOString().slice(0, 16);

  for (const candidat of candidats) {
    if (!estRenvoyable(candidat.templateKey)) {
      bilan.ignores += 1;
      continue;
    }

    const cle = `renvoi-${lot}-${candidat.templateKey}-${candidat.participantId}`;
    const quand = momentEnvoi(bilan.remis, depart);
    const confirmation = CONFIRMATIONS[candidat.templateKey];

    if (confirmation) {
      // Repasse par l'émetteur : lien signé et code de secours refabriqués.
      await envoyerConfirmation(candidat.participantId, {
        importe: confirmation.importe,
        cleIdempotence: cle,
        boite: "campagne",
      });
    } else if (candidat.templateKey === "badge_ready") {
      const { lien_espace: lienBadge } = await variablesAccesDirect(candidat.participantId, {
        avecCode: false,
      });
      await enqueueNotification(
        {
          editionId,
          templateKey: "badge_ready",
          to: candidat.to,
          participantId: candidat.participantId,
          variables: { lien_badge: lienBadge },
          boite: "campagne",
        },
        cle,
        quand,
      );
    } else {
      // Les autres modèles ne portent que les variables communes, que
      // `sendTemplatedEmail` réinjecte d'office à partir du participant.
      await enqueueNotification(
        {
          editionId,
          templateKey: candidat.templateKey,
          to: candidat.to,
          participantId: candidat.participantId,
          variables: {},
          boite: "campagne",
        },
        cle,
        quand,
      );
    }
    bilan.remis += 1;
  }

  await audit.log({
    actorType: actor.type,
    actorUserId: actor.userId,
    action: "notification.failed_resent",
    entity: "Edition",
    entityId: editionId,
    after: { remis: bilan.remis, ignores: bilan.ignores },
  });

  return bilan;
}
