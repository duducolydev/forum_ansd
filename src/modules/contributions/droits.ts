/**
 * Qui peut quoi sur les contributions (§15).
 *
 * Fonctions **pures** : elles se testent sans base ni navigateur, et c'est le
 * service qui leur fournit les faits (permissions du compte, rattachement à la
 * session, consentement de l'intervenant). L'écran les consulte pour n'afficher
 * que les gestes permis ; le service les applique de nouveau, parce qu'un
 * formulaire se falsifie.
 *
 * Trois acteurs, trois périmètres :
 *
 * - **Le gestionnaire programme** (et les administrateurs) : toutes les
 *   sessions, et seul à publier. Il rattache les rapporteurs.
 * - **Le rapporteur** : les sessions auxquelles il est rattaché, et elles
 *   seules. Il rédige et prépare ; il ne publie pas, et ne retouche pas ce qui
 *   est déjà en ligne.
 * - **L'intervenant** : dépose sa présentation depuis son espace. Elle devient
 *   une contribution en brouillon, que le comité ne peut publier qu'avec son
 *   accord — la présentation appartient à son auteur.
 */

export type Origine = "COMITE" | "INTERVENANT" | "RAPPORTEUR";

export type NiveauAcces = "complet" | "rapporteur" | "aucun";

export interface EtatContribution {
  isPublished: boolean;
  origine: Origine;
}

export interface Verdict {
  autorise: boolean;
  /** Raison du refus, formulée pour l'agent. */
  raison?: string;
}

const OUI: Verdict = { autorise: true };

/**
 * Niveau d'accès d'un compte à une session donnée.
 *
 * Le rattachement ne compte que pour le rapporteur : le gestionnaire voit
 * toutes les sessions, qu'il y soit rattaché ou non.
 */
export function niveauAcces(permissions: readonly string[], estRattache: boolean): NiveauAcces {
  if (permissions.includes("contributions.write")) return "complet";
  if (permissions.includes("contributions.draft") && estRattache) return "rapporteur";
  return "aucun";
}

export function peutCreer(niveau: NiveauAcces): Verdict {
  return niveau === "aucun"
    ? { autorise: false, raison: "Cette session ne vous est pas confiée." }
    : OUI;
}

/**
 * Modifier, supprimer, déplacer ou redéposer le fichier d'une contribution.
 *
 * Le rapporteur ne touche ni à ce qui est en ligne — une retouche ne doit pas
 * paraître sur le site sans relecture — ni à ce qu'un intervenant a déposé : ce
 * support appartient à son auteur.
 */
export function peutModifier(niveau: NiveauAcces, contribution: EtatContribution): Verdict {
  if (niveau === "complet") return OUI;
  if (niveau === "aucun")
    return { autorise: false, raison: "Cette session ne vous est pas confiée." };
  if (contribution.isPublished) {
    return {
      autorise: false,
      raison: "Cette contribution est en ligne : seul le gestionnaire programme peut la modifier.",
    };
  }
  if (contribution.origine === "INTERVENANT") {
    return {
      autorise: false,
      raison: "Cette présentation a été déposée par l'intervenant : elle ne se modifie pas ici.",
    };
  }
  return OUI;
}

/**
 * Publier une contribution.
 *
 * Deux conditions, qui ne se remplacent pas l'une l'autre : être gestionnaire,
 * et, pour une présentation d'intervenant, disposer de son accord.
 */
export function peutPublier(
  niveau: NiveauAcces,
  contribution: EtatContribution,
  consentementIntervenant: boolean,
): Verdict {
  if (niveau !== "complet") {
    return { autorise: false, raison: "Seul le gestionnaire programme publie les contributions." };
  }
  if (contribution.origine === "INTERVENANT" && !consentementIntervenant) {
    return {
      autorise: false,
      raison: "L'intervenant n'a pas autorisé la publication de sa présentation.",
    };
  }
  return OUI;
}

/** Rattacher ou retirer un rapporteur : réservé au gestionnaire. */
export function peutRattacher(niveau: NiveauAcces): Verdict {
  return niveau === "complet"
    ? OUI
    : { autorise: false, raison: "Seul le gestionnaire programme rattache les rapporteurs." };
}

/**
 * Changer l'ordre des contributions d'une session : réservé au gestionnaire.
 *
 * Déplacer un brouillon l'échange avec sa voisine, qui peut être en ligne :
 * l'ordre de la fiche publique changerait alors sans relecture.
 */
export function peutOrdonner(niveau: NiveauAcces): Verdict {
  return niveau === "complet"
    ? OUI
    : { autorise: false, raison: "Seul le gestionnaire programme ordonne les contributions." };
}
