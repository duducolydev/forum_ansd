import { prisma } from "@/lib/db";
import { avecCivilite, civiliteIntervenant } from "@/lib/civilite";
import { deuxPoints, localeIntl, selon, traduire, type Langue } from "@/lib/langue";
import { libelleRole, libelleType } from "@/modules/sessions/libelles";
import { ordonnerIntervenants } from "@/modules/sessions/ordre-intervenants";
import type { SESSION_TYPES } from "@/modules/sessions/schema";

/**
 * Récapitulatif du programme glissé dans les courriels (demande du 13 novembre
 * 2026).
 *
 * Deux variables, utilisables dans n'importe quel modèle depuis le BackOffice :
 *
 * - `{{programme}}` — le programme détaillé des journées publiées, salle et
 *   intervenants compris ;
 * - `{{mes_panels}}` — les seuls panels que le destinataire a réservés.
 *
 * ## Pourquoi au moment de l'envoi, et non de la mise en file
 *
 * Les rappels J-7 et J-1 sont **programmés à l'avance** : leurs variables sont
 * fixées des semaines avant le départ du message. Un programme recopié à la
 * planification aurait annoncé, le jour J, des horaires changés depuis. Ces
 * deux variables sont donc résolues au dernier moment, dans `sendTemplatedEmail`
 * — c'est le seul endroit qui connaisse à la fois la langue retenue et le texte
 * réellement envoyé.
 *
 * ## Pourquoi un texte brut
 *
 * `renderHtml` compose le corps ligne à ligne ; le récapitulatif suit la même
 * règle que le reste du message, l'indentation étant préservée par `renderHtml`
 * (sans quoi HTML la réduirait à une espace).
 */

/** Les variables que ce module sait remplir ; toute autre reste à l'appelant. */
export const VARIABLES_PROGRAMME = ["programme", "mes_panels"] as const;

export type VariableProgramme = (typeof VARIABLES_PROGRAMME)[number];

const TIMEZONE = "Africa/Dakar";

/** Deux niveaux d'indentation, repris tels quels par `renderHtml`. */
const RETRAIT = "  ";
const RETRAIT_2 = "    ";

// ---------------------------------------------------------------------------
// Mise en forme — fonctions pures, testées sans base
// ---------------------------------------------------------------------------

export interface IntervenantRecap {
  role: string;
  speaker: {
    civility?: string | null;
    firstName: string;
    lastName: string;
    organization?: string | null;
    participant?: { civility?: string | null } | null;
  };
}

export interface SessionRecap {
  number: number | null;
  type: (typeof SESSION_TYPES)[number];
  titleFr: string;
  titleEn: string;
  titlePt?: string | null;
  day: Date;
  startTime: Date;
  endTime: Date;
  room: { name: string } | null;
  speakers: IntervenantRecap[];
}

/** Une réservation du destinataire : la session, et le rang s'il attend. */
export interface ReservationRecap {
  session: SessionRecap;
  statut: "REGISTERED" | "WAITLISTED" | "ATTENDED";
  position: number | null;
}

function formaterJour(date: Date, langue: Langue): string {
  const locale = localeIntl(langue);
  const texte = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(date);
  // « lundi 23 novembre 2026 » ouvre une ligne : la capitale est celle d'un
  // titre, pas celle d'un mot au fil du texte.
  return texte.charAt(0).toLocaleUpperCase(locale) + texte.slice(1);
}

function formaterHeure(date: Date, langue: Langue): string {
  return new Intl.DateTimeFormat(localeIntl(langue), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(date);
}

/** Clé de regroupement par journée, indépendante de la langue d'affichage. */
function cleJour(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).format(date);
}

export function titreSession(session: SessionRecap, langue: Langue): string {
  const titre = traduire(langue, {
    fr: session.titleFr,
    en: session.titleEn,
    pt: session.titlePt,
  });
  // Le numéro est celui que le comité emploie à l'oral (« le panel 4 ») : il
  // précède le titre plutôt que d'être relégué en fin de ligne.
  return session.number ? `${session.number}. ${titre}` : titre;
}

function nomIntervenant(lien: IntervenantRecap, langue: Langue): string {
  const nom = `${lien.speaker.firstName} ${lien.speaker.lastName}`;
  const avecTitre = avecCivilite(civiliteIntervenant(lien.speaker), nom, langue);
  return lien.speaker.organization ? `${avecTitre} (${lien.speaker.organization})` : avecTitre;
}

/**
 * Les intervenants d'une session, groupés par rôle : « Modération : … » puis
 * « Panéliste : … ». Une liste à plat mettait sur le même plan celui qui anime
 * et ceux qui interviennent.
 */
function lignesIntervenants(session: SessionRecap, langue: Langue): string[] {
  const parRole = new Map<string, string[]>();
  for (const lien of ordonnerIntervenants(session.speakers)) {
    const noms = parRole.get(lien.role) ?? [];
    noms.push(nomIntervenant(lien, langue));
    parRole.set(lien.role, noms);
  }
  return [...parRole].map(
    ([role, noms]) =>
      `${RETRAIT_2}${libelleRole(role, langue)}${deuxPoints(langue)}${noms.join(", ")}`,
  );
}

/** L'en-tête d'une session : créneau, titre, nature et salle sur une ligne. */
function ligneSession(session: SessionRecap, langue: Langue, retrait: string): string {
  const creneau = `${formaterHeure(session.startTime, langue)} - ${formaterHeure(session.endTime, langue)}`;
  const salle = session.room
    ? ` — ${selon(langue, { fr: "Salle", en: "Room", pt: "Sala" })} ${session.room.name}`
    : "";
  return `${retrait}${creneau} · ${titreSession(session, langue)} [${libelleType(session.type, langue)}]${salle}`;
}

/**
 * Programme détaillé, journée par journée.
 *
 * Les sessions sont attendues déjà triées (jour, puis heure) — c'est l'ordre que
 * livre `listSessions`, et le même que celui du site public : un participant
 * doit retrouver dans son courriel la grille qu'il a sous les yeux en ligne.
 */
export function formaterProgramme(sessions: SessionRecap[], langue: Langue): string {
  if (sessions.length === 0) {
    return selon(langue, {
      fr: "Le programme détaillé sera publié prochainement sur le portail.",
      en: "The detailed programme will be published shortly on the portal.",
      pt: "O programa detalhado será publicado brevemente no portal.",
    });
  }

  const lignes: string[] = [];
  let jourCourant: string | null = null;

  for (const session of sessions) {
    const jour = cleJour(session.day);
    if (jour !== jourCourant) {
      if (jourCourant !== null) lignes.push("");
      lignes.push(formaterJour(session.day, langue));
      jourCourant = jour;
    }
    lignes.push(ligneSession(session, langue, RETRAIT));
    lignes.push(...lignesIntervenants(session, langue));
  }

  return lignes.join("\n");
}

/**
 * Les panels réservés par le destinataire.
 *
 * La liste d'attente y figure, avec son rang : c'est l'information que la
 * personne cherche en premier, et la taire lui laisserait croire sa place
 * acquise.
 */
export function formaterMesPanels(reservations: ReservationRecap[], langue: Langue): string {
  if (reservations.length === 0) {
    return selon(langue, {
      fr: "Vous n'avez réservé aucun panel pour l'instant.",
      en: "You have not booked any panel yet.",
      pt: "Ainda não reservou nenhum painel.",
    });
  }

  return reservations
    .map(({ session, statut, position }) => {
      const attente =
        statut === "WAITLISTED"
          ? ` — ${selon(langue, {
              fr: `liste d'attente, position ${position ?? "?"}`,
              en: `waiting list, position ${position ?? "?"}`,
              pt: `lista de espera, posição ${position ?? "?"}`,
            })}`
          : "";
      return `${RETRAIT}${formaterJour(session.day, langue)}\n${ligneSession(session, langue, RETRAIT_2)}${attente}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Lecture en base
// ---------------------------------------------------------------------------

const SELECTION_RECAP = {
  number: true,
  type: true,
  titleFr: true,
  titleEn: true,
  titlePt: true,
  day: true,
  startTime: true,
  endTime: true,
  room: { select: { name: true } },
  speakers: {
    orderBy: { sortOrder: "asc" },
    select: {
      role: true,
      speaker: {
        select: {
          civility: true,
          firstName: true,
          lastName: true,
          organization: true,
          participant: { select: { civility: true } },
        },
      },
    },
  },
} as const;

/**
 * Mémoire courte du programme, 60 s, par édition.
 *
 * Une campagne de rappels met un job par destinataire : sans elle, cent
 * quarante envois rejouaient cent quarante fois la même requête à quelques
 * secondes d'intervalle. La durée est celle déjà retenue pour les contenus
 * éditoriaux (PLAN.md 4.10) — assez courte pour qu'un horaire corrigé parte
 * dans la minute.
 */
const MEMOIRE_MS = 60_000;
const memoire = new Map<string, { a: number; sessions: SessionRecap[] }>();

async function sessionsPubliees(editionId: string): Promise<SessionRecap[]> {
  const enMemoire = memoire.get(editionId);
  if (enMemoire && Date.now() - enMemoire.a < MEMOIRE_MS) return enMemoire.sessions;

  const sessions = await prisma.session.findMany({
    where: { editionId, deletedAt: null, isPublished: true },
    orderBy: [{ day: "asc" }, { startTime: "asc" }, { number: "asc" }],
    select: SELECTION_RECAP,
  });

  memoire.set(editionId, { a: Date.now(), sessions });
  return sessions;
}

/** Vide la mémoire courte — appelé dès qu'une session change (`sessions/service.ts`). */
export function oublierProgramme(editionId?: string): void {
  if (editionId) memoire.delete(editionId);
  else memoire.clear();
}

async function reservations(editionId: string, participantId: string): Promise<ReservationRecap[]> {
  const lignes = await prisma.sessionRegistration.findMany({
    where: {
      participantId,
      status: { in: ["REGISTERED", "WAITLISTED", "ATTENDED"] },
      session: { editionId, deletedAt: null },
    },
    orderBy: [{ session: { day: "asc" } }, { session: { startTime: "asc" } }],
    select: {
      status: true,
      waitlistPosition: true,
      session: { select: SELECTION_RECAP },
    },
  });

  return lignes.map((ligne) => ({
    session: ligne.session,
    statut: ligne.status as ReservationRecap["statut"],
    position: ligne.waitlistPosition,
  }));
}

/**
 * Les variables de programme **réellement employées** par un texte et non déjà
 * fournies par l'appelant.
 *
 * Le tri par le texte évite de lire le programme pour un message qui n'en parle
 * pas — un code de connexion, un accusé de réception.
 */
export function variablesProgrammeUtilisees(
  texte: string,
  dejaFournies: Record<string, string> = {},
): VariableProgramme[] {
  return VARIABLES_PROGRAMME.filter(
    (nom) => dejaFournies[nom] === undefined && texte.includes(`{{${nom}}}`),
  );
}

/** Remplit les variables demandées ; `{{mes_panels}}` exige un participant. */
export async function resoudreVariablesProgramme(options: {
  editionId: string;
  participantId?: string;
  langue: Langue;
  noms: readonly VariableProgramme[];
}): Promise<Record<string, string>> {
  const resolues: Record<string, string> = {};

  if (options.noms.includes("programme")) {
    resolues.programme = formaterProgramme(
      await sessionsPubliees(options.editionId),
      options.langue,
    );
  }

  if (options.noms.includes("mes_panels")) {
    // Sans participant — un envoi à un intervenant, un message de contact — la
    // variable est remplacée par une phrase plutôt que laissée telle quelle :
    // « {{mes_panels}} » dans un courriel reçu serait un défaut visible.
    resolues.mes_panels = options.participantId
      ? formaterMesPanels(
          await reservations(options.editionId, options.participantId),
          options.langue,
        )
      : formaterMesPanels([], options.langue);
  }

  return resolues;
}
