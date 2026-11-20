/**
 * Affluence de la retransmission (20 novembre 2026).
 *
 * ## Pourquoi compter nous-mêmes
 *
 * Le nombre de spectateurs d'une diffusion YouTube n'est pas lisible depuis la
 * page : le CSP du portail interdit tout appel sortant (`connect-src 'self'`,
 * `src/middleware.ts`), et l'API de la plateforme supposerait une clé et une
 * dépendance de plus le jour J. Ce qui est mesuré ici est donc l'affluence
 * **sur le portail** — les lecteurs ouverts sur `/direct` — et non l'audience
 * totale de la diffusion, que des spectateurs suivent aussi directement sur
 * YouTube. Le BackOffice le dit, pour qu'on ne lise pas ce chiffre pour un
 * autre.
 *
 * ## Ce qui est compté, et ce qui ne l'est pas
 *
 * Un battement part **quand le lecteur est lancé**, jamais sur la simple
 * ouverture de la page : l'écran d'attente, qui reste affiché pendant les
 * pauses, ne doit pas gonfler l'affluence. Le jeton est tiré par le navigateur
 * et vit le temps de l'onglet ; deux onglets comptent donc pour deux, et une
 * page laissée ouverte continue de compter tant qu'elle l'est. Ce sont des
 * **lecteurs**, pas des personnes, et les libellés le disent.
 *
 * Aucun cookie, aucune adresse conservée, aucun lien avec un participant : le
 * jeton est un nombre au hasard, qui ne désigne personne et disparaît avec
 * l'onglet.
 */

/** Cadence des battements du navigateur. */
export const BATTEMENT_MS = 60_000;

/**
 * Au-delà, un spectateur n'est plus compté comme présent.
 *
 * Deux battements et demi : un battement perdu — réseau mobile qui bascule,
 * onglet brièvement gelé — ne doit pas faire disparaître quelqu'un de la
 * courbe, mais un onglet fermé doit en sortir vite.
 */
export const PRESENCE_MS = 150_000;

/** Pas des relevés. Cinq minutes : 288 points pour une journée entière. */
export const CRENEAU_MS = 5 * 60_000;

/** Un jeton est 32 caractères hexadécimaux, et rien d'autre. */
const JETON = /^[0-9a-f]{32}$/;

export function jetonValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && JETON.test(valeur);
}

/** Début du créneau de cinq minutes qui contient cet instant. */
export function creneau(instant: Date): Date {
  return new Date(Math.floor(instant.getTime() / CRENEAU_MS) * CRENEAU_MS);
}

/** Minuit UTC du jour — l'heure de Dakar toute l'année. */
export function jourDe(instant: Date): Date {
  return new Date(Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()));
}

export interface PointAudience {
  /** Début du créneau, ISO. */
  at: string;
  viewers: number;
}

export interface AudienceDuJour {
  /** Spectateurs distincts vus dans la journée. */
  uniques: number;
  /** Plus grand nombre de lecteurs simultanés relevé. */
  pic: number;
  /** Heure du pic, ISO ; `null` si aucun relevé. */
  picA: string | null;
  /** Lecteurs ouverts à l'instant présent — seulement pour la journée en cours. */
  maintenant: number | null;
  courbe: PointAudience[];
}

/**
 * Complète la courbe des créneaux sans relevé.
 *
 * Un créneau sans relevé n'est pas un trou dans la mesure : c'est un moment
 * où personne ne regardait, puisque le relevé est écrit par les battements
 * eux-mêmes. Sans ce remplissage, la courbe relierait deux pics par une
 * diagonale et laisserait croire à une audience continue.
 *
 * Les bornes sont celles des relevés existants, jamais la journée entière :
 * tracer de minuit à minuit noierait deux heures de diffusion dans vingt-deux
 * heures de zéro.
 */
export function completerCourbe(releves: { at: Date; viewers: number }[]): PointAudience[] {
  if (releves.length === 0) return [];

  const connus = new Map(releves.map((releve) => [creneau(releve.at).getTime(), releve.viewers]));
  const instants = [...connus.keys()].sort((a, b) => a - b);
  const premier = instants[0]!;
  const dernier = instants[instants.length - 1]!;

  const courbe: PointAudience[] = [];
  for (let instant = premier; instant <= dernier; instant += CRENEAU_MS) {
    courbe.push({ at: new Date(instant).toISOString(), viewers: connus.get(instant) ?? 0 });
  }
  return courbe;
}
