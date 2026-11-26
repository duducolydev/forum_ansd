import { VARIABLES_PROGRAMME } from "./recap-programme";

/**
 * Catalogue des courriels automatiques : quand chacun part, et avec quelles
 * variables (17 novembre 2026).
 *
 * ## Pourquoi en code et non en base
 *
 * Les variables déclarées vivaient dans la colonne `NotificationTemplate.
 * variables`, posée au premier `seed` puis rattrapée par des migrations. Deux
 * défauts :
 *
 * - une migration ne **remplit** que ce qui est encore d'origine (règle de
 *   production) ; un modèle retouché dans le BackOffice gardait donc la liste
 *   de ses débuts, et l'écran annonçait « variable non déclarée » sur un modèle
 *   pourtant juste — constaté le 17 novembre 2026 sur `reminder_j7`, dont la
 *   déclaration était restée à `prenom, lien_espace` ;
 * - le BackOffice n'offre aucun moyen de corriger cette liste : l'avertissement
 *   désignait un défaut que son lecteur ne pouvait pas réparer.
 *
 * Ce que reçoit un modèle est décidé par le code qui l'envoie, jamais par une
 * ligne en base : le catalogue est donc la seule source juste, et il suit le
 * code qui le dément. La colonne reste lue en repli, pour un modèle ajouté en
 * base sans passer par ici.
 *
 * ## Deux listes, pas une
 *
 * - `variablesDeclarees` — ce que le BackOffice propose, affiché sous le champ ;
 * - `variablesResolues` — ce qui sera **effectivement remplacé** à l'envoi, qui
 *   commande l'avertissement. La seconde ajoute `{{programme}}` et
 *   `{{mes_panels}}`, utilisables dans n'importe quel modèle
 *   (`recap-programme.ts`) : les signaler comme non déclarées aurait été faux.
 */

/** À qui s'adresse le message, ce qui décide des variables communes. */
export type Destinataire =
  /** Un participant inscrit : `sendTemplatedEmail` complète depuis sa fiche. */
  | "participant"
  /** Invité, intervenant, référent, compte BackOffice… : rien n'est déduit. */
  | "autre";

export interface EntreeCatalogue {
  /** Quand ce message part, en une phrase — affichée dans le BackOffice. */
  declenchement: string;
  destinataire: Destinataire;
  /** Variables fournies par l'émetteur, en plus des variables communes. */
  variables: readonly string[];
}

/**
 * Variables remplies pour tout destinataire rattaché à un participant, sans que
 * l'émetteur ait à les fournir (`sendTemplatedEmail`).
 *
 * Elles existent parce que l'oubli était silencieux : un rappel J-7 partait
 * avec « Téléchargez-le dans votre espace : {{lien_espace}} », la variable
 * n'étant fournie ni par `reminders.ts` ni par personne d'autre.
 */
export const VARIABLES_PARTICIPANT = [
  "prenom",
  "nom",
  "identifiant",
  "lien_espace",
  "lien_badge",
  /*
   * Deux adresses publiques, fixes (20 novembre 2026). Elles ne dépendent de
   * personne, mais elles sont ici plutôt qu'à la charge de chaque émetteur :
   * un envoi groupé depuis le BackOffice ne passe aucune variable en propre,
   * et « suivez le direct : {{lien_direct}} » serait parti tel quel.
   */
  "lien_direct",
  "lien_programme",
] as const;

export const CATALOGUE: Record<string, EntreeCatalogue> = {
  // -------------------------------------------------------------------------
  // Invitations
  // -------------------------------------------------------------------------
  invitation: {
    declenchement: "À l'envoi d'une invitation depuis le BackOffice.",
    destinataire: "autre",
    variables: ["prenom", "lien_inscription"],
  },
  invitation_reminder: {
    declenchement: "À chaque relance d'une invitation restée sans réponse.",
    destinataire: "autre",
    variables: ["prenom", "lien_inscription"],
  },

  // -------------------------------------------------------------------------
  // Inscription
  // -------------------------------------------------------------------------
  registration_received: {
    declenchement:
      "Dès l'envoi du formulaire d'inscription, quand la catégorie demande la validation du comité.",
    destinataire: "participant",
    variables: [],
  },
  registration_confirmed: {
    declenchement: "Quand le comité valide l'inscription, ou qu'elle est confirmée d'office.",
    destinataire: "participant",
    // `lien_espace` est ici un lien signé de 14 jours, qui remplace celui des
    // variables communes ; `referent_bloc` est un paragraphe entier, vide hors
    // délégation (le moteur ne sait pas conditionner).
    variables: ["lien_espace", "code6", "referent_bloc"],
  },
  registration_imported: {
    declenchement: "Quand le comité inscrit la personne par import de fichier.",
    destinataire: "participant",
    variables: ["lien_espace", "code6", "referent_bloc"],
  },

  // -------------------------------------------------------------------------
  // Presse
  // -------------------------------------------------------------------------
  accreditation_pending: {
    declenchement: "À l'envoi d'une demande d'accréditation presse.",
    destinataire: "participant",
    variables: [],
  },
  accreditation_granted: {
    declenchement: "Quand l'accréditation presse est accordée.",
    destinataire: "participant",
    variables: ["lien_espace", "code6"],
  },
  accreditation_declined: {
    declenchement: "Quand une demande d'accréditation presse est refusée.",
    destinataire: "participant",
    variables: [],
  },

  // -------------------------------------------------------------------------
  // Badge et accès
  // -------------------------------------------------------------------------
  badge_ready: {
    declenchement:
      "Quand le badge vient d'être généré : à la confirmation, ou lors d'une génération en lot.",
    destinataire: "participant",
    // Lien signé qui ouvre l'espace directement, sans passer par la connexion.
    variables: ["lien_badge"],
  },
  magic_link: {
    declenchement: "Quand un participant demande un lien de connexion à « Mon espace ».",
    destinataire: "participant",
    variables: ["lien_connexion", "code6"],
  },
  speaker_link: {
    declenchement: "Quand un intervenant reçoit ou redemande l'accès à l'espace intervenant.",
    destinataire: "autre",
    variables: ["prenom", "lien_connexion", "code6"],
  },
  admin_login_code: {
    declenchement: "À chaque connexion au BackOffice (second facteur).",
    destinataire: "autre",
    variables: ["nom", "code6", "lien_validation", "minutes"],
  },

  // -------------------------------------------------------------------------
  // Rappels avant le Forum
  // -------------------------------------------------------------------------
  reminder_j7: {
    declenchement: "Rappel programmé sept jours avant l'ouverture, depuis Notifications.",
    destinataire: "participant",
    variables: [],
  },
  reminder_j1: {
    declenchement: "Rappel programmé la veille de l'ouverture, depuis Notifications.",
    destinataire: "participant",
    variables: [],
  },

  // -------------------------------------------------------------------------
  // Programme
  // -------------------------------------------------------------------------
  session_promoted: {
    declenchement:
      "Quand une place se libère et que la première personne en liste d'attente est promue.",
    destinataire: "participant",
    variables: ["session"],
  },
  session_updated: {
    declenchement:
      "Bouton « Prévenir les inscrits », après un changement d'horaire, de salle ou de titre.",
    destinataire: "participant",
    variables: ["session", "changements", "lien_session", "lien_espace"],
  },
  session_updated_speaker: {
    declenchement: "Même annonce, adressée aux intervenants de la session.",
    // Un intervenant n'est pas toujours rattaché à un participant : tout est
    // fourni par l'émetteur, rien n'est déduit d'une fiche.
    destinataire: "autre",
    variables: ["prenom", "session", "changements", "lien_session", "lien_espace"],
  },
  session_cancelled: {
    declenchement: "Bouton « Prévenir les inscrits », quand une session est retirée du programme.",
    destinataire: "participant",
    variables: ["session", "lien_programme", "lien_espace"],
  },
  session_cancelled_speaker: {
    declenchement: "Même annonce, adressée aux intervenants de la session retirée.",
    destinataire: "autre",
    variables: ["prenom", "session", "lien_programme"],
  },

  // -------------------------------------------------------------------------
  // Communication
  // -------------------------------------------------------------------------
  newsletter_published: {
    declenchement:
      "Au bouton « Publier et envoyer » d'une newsletter, aux catégories et statuts choisis, réparti entre les boîtes d'envoi.",
    destinataire: "participant",
    // `chapo` est la description saisie ; `lien_fichier` télécharge
    // directement le PDF de synthèse (25 novembre 2026).
    variables: ["titre", "chapo", "lien_newsletter", "lien_fichier"],
  },
  thank_you: {
    declenchement: "Aucun envoi automatique : à utiliser depuis « Envoi groupé », après le Forum.",
    destinataire: "participant",
    variables: [],
  },
  /*
   * Retransmission (20 novembre 2026).
   *
   * Destiné aux inscrits que le comité ne retiendra pas en salle : la jauge du
   * King Fahd Palace est finie, les demandes ne le sont pas. Leur dire qu'ils
   * peuvent suivre à distance transforme une attente sans réponse en une
   * invitation — et c'est ce qui donnera son public à la page du direct.
   *
   * Aucun envoi automatique : ce message part depuis « Envoi groupé », avec le
   * filtre de statut, quand le comité le décide. Un courriel déclenché par un
   * effet de bord enverrait « suivez-nous en ligne » à quelqu'un dont le
   * dossier est encore à l'étude.
   */
  live_announcement: {
    declenchement:
      "Aucun envoi automatique : depuis « Envoi groupé », filtré sur le statut (inscrits non encore validés).",
    destinataire: "participant",
    variables: ["lien_direct", "lien_programme"],
  },
  contact_message: {
    declenchement:
      "À chaque message du formulaire « Nous écrire » ; part vers l'adresse de contact du comité.",
    destinataire: "autre",
    variables: ["nom", "email", "organisation", "objet", "message"],
  },

  // -------------------------------------------------------------------------
  // Délégations
  // -------------------------------------------------------------------------
  delegation_referent_assigned: {
    declenchement: "Quand un référent est rattaché à une délégation.",
    destinataire: "autre",
    variables: ["referent_nom", "delegation_nom", "delegation_pays", "effectif", "liste_membres"],
  },
  delegation_member_added: {
    declenchement: "À chaque nouveau membre d'une délégation qui a un référent.",
    destinataire: "autre",
    variables: [
      "referent_nom",
      "delegation_nom",
      "membre_nom",
      "membre_email",
      "membre_organisation",
      "effectif",
    ],
  },
};

/** Ordre stable : communes d'abord, puis les variables propres au modèle. */
function sansDoublon(noms: readonly string[]): string[] {
  return [...new Set(noms)];
}

/**
 * Les variables proposées par le BackOffice pour ce modèle.
 *
 * `repli` sert aux modèles absents du catalogue — ajoutés en base sans passer
 * par le code : la colonne `variables` reprend alors la main.
 */
export function variablesDeclarees(key: string, repli: readonly string[] = []): string[] {
  const entree = CATALOGUE[key];
  if (!entree) return sansDoublon(repli);
  const communes = entree.destinataire === "participant" ? VARIABLES_PARTICIPANT : [];
  return sansDoublon([...communes, ...entree.variables]);
}

/**
 * Les variables réellement remplacées à l'envoi — celles sur lesquelles le
 * BackOffice ne doit **pas** avertir.
 *
 * `{{programme}}` et `{{mes_panels}}` s'ajoutent partout : elles sont résolues
 * au moment de l'envoi, quel que soit le modèle.
 */
export function variablesResolues(key: string, repli: readonly string[] = []): string[] {
  return sansDoublon([...variablesDeclarees(key, repli), ...VARIABLES_PROGRAMME]);
}

/** Phrase décrivant le déclenchement, ou `null` pour un modèle hors catalogue. */
export function declenchement(key: string): string | null {
  return CATALOGUE[key]?.declenchement ?? null;
}

/**
 * Valeurs d'exemple de la prévisualisation — **jamais** de données réelles.
 *
 * Toute variable du catalogue doit en avoir une : sans cela l'aperçu affiche
 * « {{programme}} » tel quel et laisse croire à un modèle cassé (`catalogue.
 * test.ts` le vérifie).
 */
export const EXEMPLES: Record<string, string> = {
  prenom: "Aminata",
  nom: "Sow",
  identifiant: "FID26-7K3M2P",
  code6: "123456",
  minutes: "15",
  lien_connexion: "https://forum2026.ansd.sn/mon-espace/lien/xxxxx",
  lien_inscription: "https://forum2026.ansd.sn/inscription?inv=xxxxx",
  lien_espace: "https://forum2026.ansd.sn/mon-espace",
  lien_badge: "https://forum2026.ansd.sn/mon-espace",
  lien_validation: "https://forum2026.ansd.sn/connexion/valider/xxxxx",
  lien_session: "https://forum2026.ansd.sn/programme/panel-donnees-ouvertes",
  lien_programme: "https://forum2026.ansd.sn/programme",
  lien_direct: "https://forum2026.ansd.sn/direct",
  lien_newsletter: "https://forum2026.ansd.sn/newsletters/lettre-no3",
  lien_fichier: "https://forum2026.ansd.sn/api/v1/newsletters/xxxxx/fichier",
  date_limite: "15 octobre 2026",
  referent_bloc:
    "Votre délégation est accompagnée par Fatou NDIAYE (fatou.ndiaye@ansd.sn, +221 33 869 21 39).",
  session: "Panel 3 — Données ouvertes et redevabilité",
  changements:
    "  Horaire : mardi 24 novembre, 11:30 - 13:00 (au lieu de 10:15 - 11:00)\n  Salle : Amphithéatre",
  programme:
    "Lundi 23 novembre 2026\n  09:00 - 10:00 · Cérémonie d'ouverture — Amphithéatre\n  10:15 - 11:00 · Panel 1 — Salle Plénière BC12",
  mes_panels: "  Panel 1 — lundi 23 novembre, 10:15 - 11:00 (Salle Plénière BC12)",
  titre: "Le programme du Forum est en ligne",
  chapo: "Vingt séances, trois journées : découvrez le programme détaillé et réservez vos panels.",
  objet: "Question sur l'hébergement",
  email: "awa.diop@example.sn",
  organisation: "Direction de la Prévision et des Études économiques",
  message: "Bonjour,\nLes navettes desservent-elles les hôtels partenaires le dimanche ?\nMerci.",
  referent_nom: "Fatou NDIAYE",
  delegation_nom: "Délégation du Mali",
  delegation_pays: "Mali",
  effectif: "7",
  liste_membres: "  Awa DIOP (INSTAT)\n  Moussa TRAORÉ (Ministère du Plan)",
  membre_nom: "Awa DIOP",
  membre_email: "awa.diop@example.sn",
  membre_organisation: "INSTAT",
};
