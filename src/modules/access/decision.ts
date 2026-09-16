import type { ParticipantStatus, ScanResult } from "@prisma/client";

/**
 * Décision d'accès par zone (brief §2.5, §2.6, §15).
 *
 * Ce fichier est **pur** : aucune requête, aucun accès au système de fichiers,
 * aucune dépendance serveur. C'est délibéré. Le scanner hors ligne (chantier
 * 4.2) exécutera ces mêmes fonctions dans le navigateur, sur les données du
 * manifeste, pendant que le serveur les exécutera sur celles de la base. Les
 * deux doivent rendre un verdict **identique** : une divergence entre la règle
 * embarquée et la règle serveur ne se verrait qu'au premier refus injustifié,
 * devant une file d'attente, le jour J.
 *
 * Les types Prisma sont importés en `import type` — effacé à la compilation,
 * donc rien du client Prisma n'atterrit dans le bundle navigateur. L'intérêt
 * est le couplage : si l'énumération `ScanResult` change en base, ce fichier
 * cesse de compiler.
 */

export type CouleurVerdict = "VERT" | "ORANGE" | "ROUGE";

/** Anti-double-scan : même badge, même point de contrôle (brief §2.5). */
export const DELAI_ANTI_DOUBLE_SCAN_MS = 2 * 60 * 1000;

/**
 * Seuls ces statuts franchissent un point de contrôle.
 *
 * `REGISTERED` en est volontairement exclu : une inscription non validée par le
 * comité ne vaut pas droit d'entrée (brief §5.2). `CHECKED_IN` y figure, sans
 * quoi le deuxième scan de la journée serait refusé.
 */
export const STATUTS_ADMIS: readonly ParticipantStatus[] = ["CONFIRMED", "BADGED", "CHECKED_IN"];

/**
 * Ce que le scanner sait d'un badge — côté serveur comme dans le manifeste.
 *
 * Ni e-mail ni téléphone : le brief §2.11 les exclut du manifeste hors ligne, et
 * la décision n'en a aucun besoin. Ce qui n'est pas transporté ne peut pas
 * fuiter avec un appareil perdu.
 */
export interface BadgeConnu {
  publicId: string;
  statut: ParticipantStatus;
  /** Codes des zones autorisées, matrice et exceptions déjà résolues. */
  zones: readonly string[];
  /** Catégorie à accueillir : VIP, presse, invité spécial (brief §2.5). */
  alerteAccueil: boolean;
  revoque: boolean;
}

export interface ContexteScan {
  /** Zone du point de contrôle où a lieu le scan. */
  zoneCode: string;
  scanneA: Date;
  /** Dernier scan du **même badge au même point**, ou `null`. */
  dernierScanIci: Date | null;
  /** Aucun scan réussi de ce badge aujourd'hui, tous points confondus. */
  premierPassageDuJour: boolean;
}

export interface Verdict {
  couleur: CouleurVerdict;
  resultat: ScanResult;
  /** Phrase courte, affichable telle quelle en plein écran. */
  motif: string;
  /** Mentions secondaires, affichées sous le motif. */
  alertes: string[];
}

/**
 * Zones effectivement ouvertes à un participant : matrice de sa catégorie,
 * élargie de ses exceptions individuelles (brief §2.6).
 *
 * Une exception ne fait qu'**ajouter** : le brief parle d'« accès supplémentaire
 * ponctuel », jamais de retrait. Retirer une zone à un individu se fait en
 * changeant sa catégorie, ce qui reste visible et explicable.
 */
export function resoudreZones(
  zonesCategorie: readonly string[],
  exceptions: readonly string[],
): string[] {
  return [...new Set([...zonesCategorie, ...exceptions])].sort();
}

/**
 * Verdict d'un scan. `badge` vaut `null` quand le QR n'a pas été reconnu —
 * token inconnu, ou badge réémis dont l'ancienne version ne figure plus dans
 * l'index : les deux se traitent de la même façon, par un refus.
 *
 * L'ordre des contrôles est significatif et ne doit pas être réarrangé pour
 * faire plaisir à un test : un badge révoqué doit s'annoncer comme révoqué même
 * s'il est présenté à une zone qui lui serait de toute façon interdite, sans
 * quoi l'agent d'accueil croira à une simple erreur de salle et laissera
 * repartir la personne avec son badge.
 */
export function evaluerAcces(badge: BadgeConnu | null, contexte: ContexteScan): Verdict {
  if (!badge) {
    return {
      couleur: "ROUGE",
      resultat: "UNKNOWN",
      motif: "Badge inconnu",
      alertes: [],
    };
  }

  if (badge.revoque) {
    return {
      couleur: "ROUGE",
      resultat: "REVOKED",
      motif: "Badge révoqué",
      alertes: [],
    };
  }

  if (!STATUTS_ADMIS.includes(badge.statut)) {
    return {
      couleur: "ROUGE",
      resultat: "DENIED_STATUS",
      motif: badge.statut === "CANCELLED" ? "Inscription annulée" : "Inscription non confirmée",
      alertes: [],
    };
  }

  if (!badge.zones.includes(contexte.zoneCode)) {
    return {
      couleur: "ROUGE",
      resultat: "DENIED_ZONE",
      motif: "Zone non autorisée",
      alertes: [],
    };
  }

  const alertes: string[] = [];
  if (badge.alerteAccueil) alertes.push("À accueillir");
  if (contexte.premierPassageDuJour) alertes.push("Premier passage du jour");

  if (
    contexte.dernierScanIci &&
    contexte.scanneA.getTime() - contexte.dernierScanIci.getTime() < DELAI_ANTI_DOUBLE_SCAN_MS
  ) {
    return {
      couleur: "ORANGE",
      resultat: "ALREADY",
      motif: "Déjà scanné ici",
      alertes,
    };
  }

  return {
    couleur: badge.alerteAccueil ? "ORANGE" : "VERT",
    resultat: "OK",
    motif: "Accès autorisé",
    alertes,
  };
}
