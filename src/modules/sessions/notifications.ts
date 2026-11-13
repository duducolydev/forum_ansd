import { prisma } from "@/lib/db";
import { lireLangue, traduire, type Langue } from "@/lib/langue";
import { adresseIntervenant } from "@/modules/auth/magic-link";
import { enqueueNotifications } from "@/modules/notifications/jobs";
import { decrireChangements, type Changement } from "./changements";

/**
 * Avertir d'un changement au programme (demande du 13 novembre 2026).
 *
 * Jusqu'ici, déplacer un panel d'une heure ou le retirer de l'affiche ne
 * prévenait personne : les inscrits se présentaient devant une salle vide, et
 * l'intervenant apprenait le changement en arrivant. Toute modification d'une
 * session **publiée** écrit donc maintenant à ceux qu'elle concerne.
 *
 * ## Qui est prévenu
 *
 * - les **participants** inscrits à la session, liste d'attente comprise — ils
 *   attendent précisément ce créneau ;
 * - les **intervenants** rattachés, quel que soit leur statut de confirmation :
 *   un pressenti qui a bloqué sa matinée doit savoir qu'elle se déplace.
 *
 * Une même adresse n'est servie qu'une fois, et c'est le message d'intervenant
 * qui l'emporte : quelqu'un qui est à la fois sur scène et inscrit reçoit celui
 * qui le concerne le plus.
 *
 * ## Ce qui n'écrit à personne
 *
 * Une session **non publiée** : elle n'a jamais été annoncée, et le comité la
 * remanie encore. Et une session publiée dont rien de notable n'a bougé — la
 * liste des champs suivis est dans `changements.ts`.
 */

export type MotifAlerte = "modifiee" | "annulee";

/** Modèles de courriel, par motif et par public. */
const MODELES: Record<MotifAlerte, { participant: string; intervenant: string }> = {
  modifiee: { participant: "session_updated", intervenant: "session_updated_speaker" },
  annulee: { participant: "session_cancelled", intervenant: "session_cancelled_speaker" },
};

interface Destinataire {
  email: string;
  prenom: string;
  langue: Langue;
  /** Renseigné quand la personne est inscrite au Forum : l'envoi est alors journalisé. */
  participantId?: string;
  public: "participant" | "intervenant";
}

function baseUrl(): string {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
}

/**
 * Les destinataires d'une session, intervenants d'abord.
 *
 * L'ordre compte : la déduplication par adresse garde la première occurrence,
 * et c'est le message d'intervenant qui doit l'emporter.
 */
async function destinataires(sessionId: string): Promise<Destinataire[]> {
  const [intervenants, inscrits] = await Promise.all([
    prisma.sessionSpeaker.findMany({
      where: { sessionId, speaker: { deletedAt: null } },
      orderBy: { sortOrder: "asc" },
      select: {
        speaker: {
          select: {
            email: true,
            firstName: true,
            participant: { select: { id: true, email: true, locale: true } },
          },
        },
      },
    }),
    prisma.sessionRegistration.findMany({
      where: {
        sessionId,
        status: { in: ["REGISTERED", "WAITLISTED", "ATTENDED"] },
        participant: { deletedAt: null },
      },
      select: {
        participant: { select: { id: true, email: true, firstName: true, locale: true } },
      },
    }),
  ]);

  const liste: Destinataire[] = [];

  for (const { speaker } of intervenants) {
    const email = adresseIntervenant(speaker);
    // Un intervenant sans adresse propre ni participant rattaché est
    // injoignable : il relève du téléphone, pas du courriel.
    if (!email) continue;
    liste.push({
      email,
      prenom: speaker.firstName,
      langue: lireLangue(speaker.participant?.locale),
      participantId: speaker.participant?.id,
      public: "intervenant",
    });
  }

  for (const { participant } of inscrits) {
    liste.push({
      email: participant.email,
      prenom: participant.firstName,
      langue: lireLangue(participant.locale),
      participantId: participant.id,
      public: "participant",
    });
  }

  const vues = new Set<string>();
  return liste.filter((destinataire) => {
    const cle = destinataire.email.trim().toLowerCase();
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
}

/**
 * Combien de personnes une annonce atteindrait.
 *
 * Affiché sur le bouton : « Prévenir les 37 inscrits et intervenants ». Un
 * bouton qui n'annonce pas sa portée se presse sans y penser, et c'est
 * justement ce que le geste explicite cherche à éviter.
 */
export async function compterDestinataires(sessionId: string): Promise<number> {
  return (await destinataires(sessionId)).length;
}

export interface AlerteSession {
  editionId: string;
  sessionId: string;
  slug: string;
  titre: { fr: string; en: string; pt?: string | null };
  motif: MotifAlerte;
  /** Vide pour une annulation ; au moins un élément pour une modification. */
  changements: Changement[];
  /**
   * Empreinte de l'écriture qui déclenche l'alerte — en pratique le `updatedAt`
   * de la session.
   *
   * Elle entre dans la clé d'idempotence : un double envoi du formulaire porte
   * la même, et le second message est écarté ; un vrai second changement, une
   * heure plus tard, en porte une autre et part bien. Lier la clé au seul
   * identifiant de session aurait fait taire la seconde annonce.
   */
  empreinte: string;
}

/**
 * Met en file les avertissements et rend le nombre de personnes prévenues.
 *
 * Une seule mise en file pour toute la session plutôt qu'un appel par
 * destinataire : l'enregistrement d'un formulaire ne doit pas attendre deux
 * cents allers-retours (même raison qu'au §22 pour les invitations).
 */
export async function alerterSession(alerte: AlerteSession): Promise<number> {
  if (alerte.motif === "modifiee" && alerte.changements.length === 0) return 0;

  const personnes = await destinataires(alerte.sessionId);
  if (personnes.length === 0) return 0;

  const lienSession = `${baseUrl()}/programme/${alerte.slug}`;

  await enqueueNotifications(
    personnes.map((personne) => ({
      payload: {
        editionId: alerte.editionId,
        templateKey: MODELES[alerte.motif][personne.public],
        to: personne.email,
        participantId: personne.participantId,
        variables: {
          prenom: personne.prenom,
          session: traduire(personne.langue, alerte.titre),
          changements: decrireChangements(alerte.changements, personne.langue),
          lien_session: lienSession,
          // La fiche d'une session annulée n'est plus en ligne : le message
          // d'annulation renvoie vers le programme, qui existe toujours.
          lien_programme: `${baseUrl()}/programme`,
          lien_espace:
            personne.public === "intervenant"
              ? `${baseUrl()}/espace-intervenant`
              : `${baseUrl()}/mon-espace`,
        },
        // La langue est portée par le job : un intervenant n'a pas de `locale`
        // à lui, et `sendTemplatedEmail` la déduirait du participant rattaché —
        // absent la plupart du temps.
        locale: personne.langue,
      },
      idempotencyKey: `session-${alerte.motif}:${alerte.sessionId}:${alerte.empreinte}:${personne.email}`,
    })),
  );

  return personnes.length;
}

/**
 * Même chose, mais sans jamais faire échouer l'écriture qui la précède.
 *
 * Le changement d'horaire est l'acte utile ; une file indisponible ne doit pas
 * le refuser, laissant le comité croire que rien n'a été enregistré. L'incident
 * est tracé dans le journal du serveur.
 */
export async function alerterSansBloquer(alerte: AlerteSession): Promise<number> {
  try {
    return await alerterSession(alerte);
  } catch (error) {
    console.error("Alerte de changement de session non mise en file", {
      sessionId: alerte.sessionId,
      motif: alerte.motif,
      error,
    });
    return 0;
  }
}
