import type { ParticipantStatus } from "@prisma/client";

/**
 * Affluence attendue par journée (22 novembre 2026).
 *
 * ## À quoi cela sert
 *
 * Beaucoup d'inscrits ne viennent qu'un jour ou deux. Les journées creuses
 * laissent donc des places que d'autres demandes, en attente de validation,
 * pourraient prendre. Ce module compte, journée par journée, qui a **déclaré**
 * venir — la case cochée au formulaire d'inscription — et compare au repère de
 * salle fixé dans les paramètres.
 *
 * ## Ce que ces chiffres ne disent pas
 *
 * **Une déclaration n'est pas une réservation.** Le badge d'un participant
 * validé ouvre les trois journées, quelle que soit la case qu'il a cochée
 * (règle du comité, et elle ne change pas) : rien n'empêche qui a déclaré le
 * seul 24 de se présenter le 23. La jauge compare donc des **déclarations**,
 * pas des entrées, et une journée affichée à 70 % peut se remplir à 95 %.
 *
 * Deux garde-fous, en conséquence :
 *
 * - les participants **sans journée déclarée** — import par fichier, inscription
 *   au comptoir — sont comptés à part et jamais répartis sur les journées. Les
 *   oublier sous-estimerait la salle, c'est-à-dire se tromper du mauvais côté ;
 * - `parNombreDeJours` dit si l'information vaut quelque chose. Si la plupart
 *   des confirmés ont coché les trois journées, il n'y a aucune place à
 *   libérer, et le reste de l'écran ne fait que le confirmer avec plus de
 *   chiffres.
 *
 * Dès le soir de la première journée, le constaté des scans (écran Présences)
 * dit de combien la déclaration s'écarte de la réalité ; c'est lui qui doit
 * servir de correctif pour les journées suivantes.
 *
 * Module **pur** : il ne connaît ni Prisma ni l'édition active. Les règles de
 * comptage se vérifient ainsi sur des lignes écrites à la main, et c'est là
 * qu'est la subtilité — pas dans la requête.
 */

/** Statuts d'un dossier validé par le comité : ces gens viendront. */
const CONFIRMES: ParticipantStatus[] = ["CONFIRMED", "BADGED", "CHECKED_IN"];

/** Dossier complet mais pas encore validé : le vivier dans lequel puiser. */
const EN_ATTENTE: ParticipantStatus[] = ["REGISTERED"];

/** Une journée du Forum, telle que la propose le formulaire d'inscription. */
export interface JourForum {
  value: string;
  label: string;
}

/** Ce qu'il faut savoir d'un participant pour le compter, et rien de plus. */
export interface LigneAffluence {
  status: ParticipantStatus;
  /** Valeur brute du champ JSON : jamais tenue pour un tableau de chaînes. */
  participationDays: unknown;
  categorieLabel: string;
  attendsOpening: boolean;
  attendsClosing: boolean;
  attendsAwards: boolean;
}

export interface Effectif {
  confirmes: number;
  enAttente: number;
}

export interface JourneeAffluence extends Effectif {
  jour: string;
  libelle: string;
  /** Places fixées dans les paramètres. `null` quand rien n'est fixé. */
  jauge: number | null;
  /** Jauge moins les confirmés déclarés. Négatif si la jauge est dépassée. */
  placesRestantes: number | null;
  /** Confirmés déclarés rapportés à la jauge, en pourcentage entier. */
  occupation: number | null;
  /** Confirmés déclarés, par catégorie, les plus nombreuses d'abord. */
  parCategorie: { label: string; value: number }[];
}

export interface AffluenceEdition {
  journees: JourneeAffluence[];
  /** Validés et en attente qui n'ont déclaré aucune journée connue. */
  sansJour: Effectif;
  /** Totaux, toutes journées confondues : des personnes, pas des présences. */
  totaux: Effectif;
  /**
   * Confirmés par nombre de journées déclarées (1, 2, 3…). Dit d'un coup d'œil
   * s'il y a quelque chose à récupérer.
   */
  parNombreDeJours: { jours: number; valeur: number }[];
  ceremonies: ({ libelle: string } & Effectif)[];
}

/**
 * Journées déclarées, lues sans rien supposer.
 *
 * Le champ est du JSON libre en base : il a pu recevoir `null`, un objet, ou
 * des dates d'une édition dont les dates ont changé depuis. Seules les chaînes
 * qui correspondent à une journée **du Forum** sont retenues, et les doublons
 * sont écartés — une même journée comptée deux fois gonflerait la salle.
 */
export function joursDeclares(valeur: unknown, joursConnus: Set<string>): string[] {
  if (!Array.isArray(valeur)) return [];
  const retenus = new Set<string>();
  for (const element of valeur) {
    if (typeof element === "string" && joursConnus.has(element)) retenus.add(element);
  }
  return [...retenus];
}

function vide(): Effectif {
  return { confirmes: 0, enAttente: 0 };
}

export function calculerAffluence(params: {
  jours: JourForum[];
  jauges: Record<string, number>;
  lignes: LigneAffluence[];
}): AffluenceEdition {
  const { jours, jauges, lignes } = params;
  const joursConnus = new Set(jours.map((jour) => jour.value));

  const parJour = new Map<string, Effectif>(jours.map((jour) => [jour.value, vide()]));
  const categoriesParJour = new Map<string, Map<string, number>>(
    jours.map((jour) => [jour.value, new Map()]),
  );
  const sansJour = vide();
  const totaux = vide();
  const nombreDeJours = new Map<number, number>();
  const ceremonies = {
    ouverture: vide(),
    cloture: vide(),
    prix: vide(),
  };

  for (const ligne of lignes) {
    const confirme = CONFIRMES.includes(ligne.status);
    const enAttente = EN_ATTENTE.includes(ligne.status);
    // Ni l'un ni l'autre : dossier non terminé, décliné ou annulé. Il n'occupe
    // aucune place et n'en libère aucune.
    if (!confirme && !enAttente) continue;

    const cle = confirme ? "confirmes" : "enAttente";
    totaux[cle] += 1;

    const declares = joursDeclares(ligne.participationDays, joursConnus);
    if (declares.length === 0) {
      sansJour[cle] += 1;
    } else {
      for (const jour of declares) {
        parJour.get(jour)![cle] += 1;
        if (confirme) {
          const categories = categoriesParJour.get(jour)!;
          categories.set(ligne.categorieLabel, (categories.get(ligne.categorieLabel) ?? 0) + 1);
        }
      }
    }

    if (confirme) {
      nombreDeJours.set(declares.length, (nombreDeJours.get(declares.length) ?? 0) + 1);
    }
    if (ligne.attendsOpening) ceremonies.ouverture[cle] += 1;
    if (ligne.attendsClosing) ceremonies.cloture[cle] += 1;
    if (ligne.attendsAwards) ceremonies.prix[cle] += 1;
  }

  return {
    journees: jours.map((jour) => {
      const effectif = parJour.get(jour.value)!;
      /*
       * Zéro vaut « pas de jauge », comme une case laissée vide : afficher
       * « 0 place disponible » et une barre pleine sur une journée dont
       * personne n'a fixé la capacité ferait croire à une salle comble.
       */
      const brute = jauges[jour.value] ?? 0;
      const jauge = brute > 0 ? brute : null;
      return {
        jour: jour.value,
        libelle: jour.label,
        ...effectif,
        jauge,
        placesRestantes: jauge === null ? null : jauge - effectif.confirmes,
        occupation: jauge === null ? null : Math.round((effectif.confirmes / jauge) * 100),
        parCategorie: [...categoriesParJour.get(jour.value)!.entries()]
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "fr")),
      };
    }),
    sansJour,
    totaux,
    parNombreDeJours: [...nombreDeJours.entries()]
      .filter(([jours]) => jours > 0)
      .map(([jours, valeur]) => ({ jours, valeur }))
      .sort((a, b) => a.jours - b.jours),
    ceremonies: [
      { libelle: "Cérémonie d'ouverture", ...ceremonies.ouverture },
      { libelle: "Cérémonie de clôture", ...ceremonies.cloture },
      { libelle: "Remise des prix", ...ceremonies.prix },
    ],
  };
}
