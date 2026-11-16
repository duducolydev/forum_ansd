import type { ParticipantStatus } from "@prisma/client";

/**
 * Qui a le droit d'ouvrir « Mon espace » (16 novembre 2026).
 *
 * Jusqu'ici, **n'importe quel participant** en base recevait un lien de
 * connexion, quel que soit l'avancement de son dossier. Une personne inscrite
 * mais pas encore validée par le comité recevait donc un lien et un code à six
 * chiffres — ce qui lui laissait croire son compte ouvert —, puis butait sur un
 * « lien invalide ou expiré » dès que le lien, à usage unique et valable trente
 * minutes, était consommé ou périmé. Le message ne disait rien de la vraie
 * raison, et ces personnes écrivaient au comité.
 *
 * La règle est posée **ici et nulle part ailleurs** : elle commande l'envoi du
 * lien, la consommation du lien, la saisie du code et l'affichage de l'espace.
 * Dispersée, elle aurait fini par autoriser d'un côté ce qu'elle refuse de
 * l'autre — c'est exactement ce qui produit le lien qui s'envoie puis ne
 * s'ouvre pas.
 *
 * Module **sans dépendance serveur** (le seul import est un type, effacé à la
 * compilation) : les textes servent aussi bien à la page qu'au formulaire de
 * connexion, qui est un composant client.
 */

export type MotifRefusAcces =
  "EN_ATTENTE_VALIDATION" | "INSCRIPTION_INCOMPLETE" | "INSCRIPTION_CLOSE";

export type AccesEspace = { autorise: true } | { autorise: false; motif: MotifRefusAcces };

/** Statuts d'un dossier validé : le compte est ouvert. */
const VALIDES: ParticipantStatus[] = ["CONFIRMED", "BADGED", "CHECKED_IN"];

/** Dossier clos : l'intéressé a décliné, ou le comité a annulé. */
const CLOS: ParticipantStatus[] = ["DECLINED", "CANCELLED"];

/**
 * Le participant peut-il ouvrir son espace ?
 *
 * La presse en attente d'accréditation fait exception et **garde** son accès :
 * son espace ne montre alors que l'état de sa demande (arbitrage du
 * 29 septembre 2026, `mon-espace/page.tsx`). Lui fermer la porte ici
 * supprimerait un écran voulu.
 */
export function accesEspace(participant: {
  status: ParticipantStatus;
  category: { requiresAccreditation: boolean };
}): AccesEspace {
  if (VALIDES.includes(participant.status)) return { autorise: true };
  if (CLOS.includes(participant.status)) {
    return { autorise: false, motif: "INSCRIPTION_CLOSE" };
  }
  if (participant.status === "REGISTERED") {
    return participant.category.requiresAccreditation
      ? { autorise: true }
      : { autorise: false, motif: "EN_ATTENTE_VALIDATION" };
  }
  // INVITED, INVITATION_SENT, REGISTRATION_STARTED : le formulaire d'inscription
  // n'est pas allé à son terme, il n'y a pas encore de dossier à valider.
  return { autorise: false, motif: "INSCRIPTION_INCOMPLETE" };
}

// ---------------------------------------------------------------------------
// Ce qui est dit à la personne
// ---------------------------------------------------------------------------

interface Trois {
  fr: string;
  en: string;
  pt: string;
}

export interface TexteRefus {
  titre: Trois;
  message: Trois;
}

/**
 * Un texte par motif, dans les trois langues du portail.
 *
 * Chacun dit **pourquoi** la porte est fermée et **ce qui se passera ensuite** :
 * un refus qui n'annonce pas la suite envoie la personne écrire au comité, ce
 * que le message est précisément là pour éviter.
 */
export const TEXTES_REFUS: Record<MotifRefusAcces, TexteRefus> = {
  EN_ATTENTE_VALIDATION: {
    titre: {
      fr: "Inscription en attente de validation",
      en: "Registration awaiting validation",
      pt: "Inscrição a aguardar validação",
    },
    message: {
      fr: "Votre inscription est bien enregistrée et attend la validation du comité d'organisation. Votre espace s'ouvrira dès qu'elle sera confirmée : vous recevrez alors un e-mail contenant un accès direct, sans avoir à demander de lien. Aucune démarche n'est nécessaire de votre part d'ici là.",
      en: "Your registration has been recorded and is awaiting validation by the organising committee. Your space will open as soon as it is confirmed: you will then receive an email with direct access, with no link to request. There is nothing for you to do until then.",
      pt: "A sua inscrição foi registada e aguarda validação pela comissão organizadora. O seu espaço abrirá assim que for confirmada: receberá então um e-mail com acesso direto, sem ter de pedir qualquer ligação. Até lá, não tem nada a fazer.",
    },
  },
  INSCRIPTION_INCOMPLETE: {
    titre: {
      fr: "Inscription à terminer",
      en: "Registration to complete",
      pt: "Inscrição por concluir",
    },
    message: {
      fr: "Votre inscription n'a pas encore été envoyée : l'espace participant s'ouvre une fois le formulaire rempli, puis validé par le comité d'organisation. Reprenez le lien personnel de votre invitation, ou remplissez le formulaire d'inscription.",
      en: "Your registration has not been submitted yet: the participant space opens once the form has been completed and then validated by the organising committee. Use the personal link from your invitation, or fill in the registration form.",
      pt: "A sua inscrição ainda não foi enviada: o espaço do participante abre depois de o formulário estar preenchido e validado pela comissão organizadora. Utilize a ligação pessoal do seu convite ou preencha o formulário de inscrição.",
    },
  },
  INSCRIPTION_CLOSE: {
    titre: {
      fr: "Inscription annulée",
      en: "Registration cancelled",
      pt: "Inscrição anulada",
    },
    message: {
      fr: "Cette inscription a été annulée et l'espace participant n'est plus accessible. S'il s'agit d'une erreur, écrivez au comité d'organisation depuis la rubrique « Nous écrire » du portail.",
      en: "This registration has been cancelled and the participant space is no longer available. If this is a mistake, write to the organising committee through the “Write to us” section of the portal.",
      pt: "Esta inscrição foi anulada e o espaço do participante já não está acessível. Se se tratar de um erro, escreva à comissão organizadora através da secção «Escreva-nos» do portal.",
    },
  },
};

/**
 * Motif reconnu, pour relire un paramètre d'URL sans lui faire confiance.
 *
 * `Object.hasOwn` et non `in` : `in` remonte la chaîne de prototypes, si bien
 * que `?refus=toString` passait pour un motif valide et faisait chercher un
 * titre dans une fonction. Le test le signalait.
 */
export function lireMotifRefus(valeur: unknown): MotifRefusAcces | null {
  return typeof valeur === "string" && Object.hasOwn(TEXTES_REFUS, valeur)
    ? (valeur as MotifRefusAcces)
    : null;
}
