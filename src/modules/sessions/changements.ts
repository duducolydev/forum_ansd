import { deuxPoints, localeIntl, selon, traduire, type Langue } from "@/lib/langue";

/**
 * Ce qui, dans une session, mérite d'être annoncé (demande du 13 novembre
 * 2026).
 *
 * Toute modification ne vaut pas un courriel. Corriger une faute dans la
 * description, déposer un TDR ou rouvrir les réservations ne change rien à ce
 * que le destinataire doit faire ; **le jour, l'heure, la salle et le titre**,
 * si : ce sont les quatre informations qu'il a notées quelque part, et sur
 * lesquelles il a organisé sa venue.
 *
 * Les textes sont produits dans les trois langues **au moment de la
 * comparaison**, une seule fois, puis distribués à chaque destinataire selon la
 * sienne : la comparaison connaît les deux états, l'envoi non.
 *
 * Module pur, sans base ni Prisma : il se teste sans serveur.
 */

const TIMEZONE = "Africa/Dakar";

export type ChampSuivi = "jour" | "horaire" | "salle" | "titre";

export interface Trois {
  fr: string;
  en: string;
  pt: string;
}

export interface Changement {
  champ: ChampSuivi;
  /** « Horaire : 09:00 - 10:30 → 11:00 - 12:30 », dans les trois langues. */
  texte: Trois;
}

/** L'état comparé d'une session : rien de plus que les quatre champs suivis. */
export interface EtatSuivi {
  titleFr: string;
  titleEn: string;
  titlePt?: string | null;
  day: Date;
  startTime: Date;
  endTime: Date;
  salle: string | null;
}

const LIBELLES: Record<ChampSuivi, Trois> = {
  jour: { fr: "Date", en: "Date", pt: "Data" },
  horaire: { fr: "Horaire", en: "Time", pt: "Horário" },
  salle: { fr: "Salle", en: "Room", pt: "Sala" },
  titre: { fr: "Intitulé", en: "Title", pt: "Título" },
};

const SANS_SALLE: Trois = {
  fr: "salle non précisée",
  en: "room to be confirmed",
  pt: "sala por confirmar",
};

const LANGUES: Langue[] = ["fr", "en", "pt"];

function enTroisLangues(valeur: (langue: Langue) => string): Trois {
  return { fr: valeur("fr"), en: valeur("en"), pt: valeur("pt") };
}

function jour(date: Date, langue: Langue): string {
  return new Intl.DateTimeFormat(localeIntl(langue), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(date);
}

function heure(date: Date, langue: Langue): string {
  return new Intl.DateTimeFormat(localeIntl(langue), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).format(date);
}

function creneau(etat: EtatSuivi, langue: Langue): string {
  return `${heure(etat.startTime, langue)} - ${heure(etat.endTime, langue)}`;
}

function titre(etat: EtatSuivi, langue: Langue): string {
  return traduire(langue, { fr: etat.titleFr, en: etat.titleEn, pt: etat.titlePt });
}

/** « Horaire : avant → après », construite dans les trois langues d'un coup. */
function changement(
  champ: ChampSuivi,
  valeur: (etat: EtatSuivi, langue: Langue) => string,
  avant: EtatSuivi,
  apres: EtatSuivi,
): Changement {
  return {
    champ,
    texte: enTroisLangues(
      (langue) =>
        `${selon(langue, LIBELLES[champ])}${deuxPoints(langue)}${valeur(avant, langue)} → ${valeur(apres, langue)}`,
    ),
  };
}

/**
 * Ce qui a changé entre deux états, dans l'ordre où cela se lit : la date
 * d'abord, puis l'heure, la salle, l'intitulé.
 *
 * La comparaison porte sur les instants et les textes, pas sur leur rendu : un
 * même horaire réécrit à l'identique ne produit aucun changement, et
 * l'enregistrement d'un formulaire rouvert sans rien toucher n'envoie rien.
 */
export function comparerSession(avant: EtatSuivi, apres: EtatSuivi): Changement[] {
  const changements: Changement[] = [];

  if (jourUtc(avant.day) !== jourUtc(apres.day)) {
    changements.push(changement("jour", (etat, langue) => jour(etat.day, langue), avant, apres));
  }
  if (
    avant.startTime.getTime() !== apres.startTime.getTime() ||
    avant.endTime.getTime() !== apres.endTime.getTime()
  ) {
    changements.push(changement("horaire", creneau, avant, apres));
  }
  if ((avant.salle ?? "") !== (apres.salle ?? "")) {
    changements.push(
      changement("salle", (etat, langue) => etat.salle ?? selon(langue, SANS_SALLE), avant, apres),
    );
  }
  // L'intitulé est comparé langue par langue : une traduction corrigée seule
  // ne doit pas écrire à tout le monde, mais seulement à ceux qui la lisent.
  if (LANGUES.some((langue) => titre(avant, langue) !== titre(apres, langue))) {
    changements.push(changement("titre", titre, avant, apres));
  }

  return changements;
}

/** Journée calendaire, pour comparer deux `day` sans tenir compte de l'heure. */
function jourUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Les changements en liste à puces, prêts pour `{{changements}}`. */
export function decrireChangements(changements: Changement[], langue: Langue): string {
  return changements.map((ligne) => `  - ${selon(langue, ligne.texte)}`).join("\n");
}

// ---------------------------------------------------------------------------
// État annoncé — mémorisé en base (`Session.announcedState`)
// ---------------------------------------------------------------------------

/**
 * L'état suivi d'une session, prêt à être rangé en JSON.
 *
 * Les instants deviennent des chaînes ISO : une date traverse `JSON` en texte
 * de toute façon, autant que le format soit celui qu'on relit sans ambiguïté.
 */
export function figerEtat(etat: EtatSuivi): Record<string, string | null> {
  return {
    titleFr: etat.titleFr,
    titleEn: etat.titleEn,
    titlePt: etat.titlePt ?? null,
    day: etat.day.toISOString(),
    startTime: etat.startTime.toISOString(),
    endTime: etat.endTime.toISOString(),
    salle: etat.salle,
  };
}

function chaine(valeur: unknown): string | null {
  return typeof valeur === "string" ? valeur : null;
}

function instant(valeur: unknown): Date | null {
  const texte = chaine(valeur);
  if (!texte) return null;
  const date = new Date(texte);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Relit un état annoncé, ou rend `null` s'il est absent ou illisible.
 *
 * La colonne est un `Json` : son contenu n'est garanti par aucun type. Une
 * valeur écrite par une version antérieure, ou tronquée, doit faire conclure
 * « rien d'annoncé » — pas planter l'écran du programme.
 */
export function lireEtatAnnonce(valeur: unknown): EtatSuivi | null {
  if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return null;
  const brut = valeur as Record<string, unknown>;

  const titleFr = chaine(brut.titleFr);
  const titleEn = chaine(brut.titleEn);
  const day = instant(brut.day);
  const startTime = instant(brut.startTime);
  const endTime = instant(brut.endTime);
  if (titleFr === null || titleEn === null || !day || !startTime || !endTime) return null;

  return {
    titleFr,
    titleEn,
    titlePt: chaine(brut.titlePt),
    day,
    startTime,
    endTime,
    salle: chaine(brut.salle),
  };
}
