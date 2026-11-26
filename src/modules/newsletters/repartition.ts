import type { BoiteEnvoi } from "@/lib/mail";

/**
 * Répartition d'un envoi de newsletter entre les boîtes (25 novembre 2026).
 *
 * ## Le problème
 *
 * Un compte Gmail ordinaire envoie cinq cents messages par vingt-quatre heures
 * glissantes. Les inscrits du Forum sont plus nombreux : une newsletter
 * envoyée par une seule boîte s'arrêterait au cinq-centième, et le reste
 * tomberait en `550-5.4.5`, comme les rappels du 17 novembre.
 *
 * ## La réponse
 *
 * Les destinataires sont distribués **à tour de rôle** entre les comptes
 * retenus, chacun dans la limite de ce qu'il peut encore envoyer aujourd'hui.
 * Ce qui dépasse la capacité du jour est programmé le lendemain, à la même
 * heure, quand la fenêtre glissante a rendu le quota ; et ainsi de suite.
 *
 * Chaque compte garde sa propre cadence (`ENVOIS_PAR_MINUTE`) : quatre comptes
 * envoient à quatre fois la vitesse d'un seul, sans qu'aucun ne dépasse le
 * rythme que Google tolère.
 *
 * Module **pur** : ni base ni SMTP. Ce qu'un compte a déjà consommé lui est
 * fourni par l'appelant (`envoi.ts`), qui le lit dans le journal.
 */

/** Un compte d'envoi, tel que la répartition le voit. */
export interface CompteEnvoi {
  /** Identité du compte (`compteBoite`) : deux boîtes repliées sur un même compte n'en font qu'un. */
  cle: string;
  /** Boîte par laquelle ce compte envoie. */
  boite: BoiteEnvoi;
  /** Adresse affichée. */
  adresse: string;
  /** Messages par vingt-quatre heures confiés à la newsletter, réserve déduite. */
  plafond: number;
  /** Déjà consommé sur les vingt-quatre dernières heures. */
  dejaUtilise: number;
}

/** Envois déjà programmés par une autre newsletter, à déduire des capacités. */
export interface Reservation {
  cle: string;
  debut: Date;
  nombre: number;
}

/** Ce qu'un compte envoie un jour donné. */
export interface Lot {
  boite: BoiteEnvoi;
  adresse: string;
  cle: string;
  /** 0 pour aujourd'hui, 1 pour le lendemain… */
  jour: number;
  /** Heure du premier message du lot (ISO). */
  debut: string;
  nombre: number;
}

export interface PlanEnvoi {
  /** Pour chaque destinataire, dans l'ordre fourni : sa boîte et son heure. */
  affectations: { boite: BoiteEnvoi; runAt: Date }[];
  lots: Lot[];
  /** Nombre de jours sur lesquels l'envoi s'étale. */
  jours: number;
}

export class RepartitionImpossible extends Error {}

const JOUR_MS = 24 * 3600_000;
/**
 * Marge ajoutée au départ des jours suivants : la fenêtre de Google glisse à
 * la seconde, et le premier message du lendemain ne doit pas arriver avant que
 * le premier de la veille en soit sorti.
 */
const MARGE_JOUR_MS = 15 * 60_000;

/** Début du jour `jour` de l'envoi. */
export function debutJour(depart: Date, jour: number): Date {
  return jour === 0 ? depart : new Date(depart.getTime() + jour * JOUR_MS + MARGE_JOUR_MS);
}

/** Ce que les autres newsletters ont déjà programmé sur ce compte autour de ce moment. */
function reserve(reservations: Reservation[], cle: string, debut: Date): number {
  return reservations
    .filter(
      (reservation) =>
        reservation.cle === cle &&
        Math.abs(reservation.debut.getTime() - debut.getTime()) < JOUR_MS,
    )
    .reduce((total, reservation) => total + reservation.nombre, 0);
}

export function planifierEnvoi(
  nombre: number,
  comptes: CompteEnvoi[],
  depart: Date,
  options: { envoisParMinute: number; joursMax?: number; reservations?: Reservation[] },
): PlanEnvoi {
  const joursMax = options.joursMax ?? 14;
  const reservations = options.reservations ?? [];
  const intervalle = 60_000 / options.envoisParMinute;

  if (nombre === 0) return { affectations: [], lots: [], jours: 0 };

  // Doublons de compte écartés : deux boîtes sur un même compte n'en font qu'une.
  const uniques = comptes.filter(
    (compte, index) => comptes.findIndex((autre) => autre.cle === compte.cle) === index,
  );
  if (uniques.length === 0 || uniques.every((compte) => compte.plafond <= 0)) {
    throw new RepartitionImpossible("Aucune boîte d'envoi retenue, ou aucune capacité.");
  }

  const affectations: { boite: BoiteEnvoi; runAt: Date }[] = [];
  const lots: Lot[] = [];
  let restant = nombre;
  let jour = 0;

  while (restant > 0) {
    if (jour >= joursMax) {
      throw new RepartitionImpossible(
        `L'envoi demanderait plus de ${joursMax} jours avec ces boîtes : ajoutez-en, ou réduisez la population visée.`,
      );
    }

    const debut = debutJour(depart, jour);
    const capacites = uniques.map((compte) =>
      Math.max(
        0,
        compte.plafond -
          (jour === 0 ? compte.dejaUtilise : 0) -
          reserve(reservations, compte.cle, debut),
      ),
    );
    const envoyes = uniques.map(() => 0);

    // À tour de rôle : les comptes avancent ensemble, et les destinataires
    // fournis en premier partent en premier, quel que soit le compte.
    let place = true;
    while (restant > 0 && place) {
      place = false;
      uniques.forEach((compte, index) => {
        if (restant === 0 || envoyes[index]! >= capacites[index]!) return;
        affectations.push({
          boite: compte.boite,
          runAt: new Date(debut.getTime() + Math.round(envoyes[index]! * intervalle)),
        });
        envoyes[index]! += 1;
        restant -= 1;
        place = true;
      });
    }

    uniques.forEach((compte, index) => {
      if (envoyes[index]! > 0) {
        lots.push({
          boite: compte.boite,
          adresse: compte.adresse,
          cle: compte.cle,
          jour,
          debut: debut.toISOString(),
          nombre: envoyes[index]!,
        });
      }
    });
    jour += 1;
  }

  return { affectations, lots, jours: jour };
}
