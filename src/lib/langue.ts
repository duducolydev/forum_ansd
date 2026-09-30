/**
 * Langues du site (portugais ajouté le 30 septembre 2026).
 *
 * Module **sans dépendance serveur** : il sert aux pages comme aux composants
 * clients.
 *
 * ## Repli
 *
 * Un contenu saisi en BackOffice n'existe pas forcément dans les trois
 * langues. Le français est toujours renseigné — c'est la langue du Forum.
 * L'anglais l'est presque toujours. Le portugais s'ajoute au fil de l'eau :
 * absent, on affiche l'**anglais**, plus proche pour un public lusophone
 * international que le français (arbitrage du 30 septembre 2026), puis le
 * français en dernier recours.
 */

export const LANGUES = ["fr", "en", "pt"] as const;
export type Langue = (typeof LANGUES)[number];

export function estLangue(valeur: unknown): valeur is Langue {
  return typeof valeur === "string" && (LANGUES as readonly string[]).includes(valeur);
}

/** Langue reconnue, ou le français. */
export function lireLangue(valeur: unknown): Langue {
  return estLangue(valeur) ? valeur : "fr";
}

/** Ordre de repli de chaque langue. */
const REPLIS: Record<Langue, Langue[]> = {
  fr: ["fr"],
  en: ["en", "fr"],
  pt: ["pt", "en", "fr"],
};

function texte(valeur: unknown): string {
  return typeof valeur === "string" ? valeur : "";
}

/**
 * Valeur d'un contenu dans la langue demandée, avec repli : la première
 * valeur non vide dans l'ordre de `REPLIS`.
 */
export function traduire(
  langue: string,
  valeurs: { fr?: unknown; en?: unknown; pt?: unknown },
): string {
  for (const candidate of REPLIS[lireLangue(langue)]) {
    const valeur = texte(valeurs[candidate]);
    if (valeur.trim().length > 0) return valeur;
  }
  return texte(valeurs.fr);
}

/**
 * Texte d'interface écrit dans le code, dans les trois langues.
 *
 * Remplace les ternaires `en ? … : …` : un troisième membre obligatoire, et le
 * compilateur signale tout texte laissé sans portugais.
 */
export function selon<T>(langue: string, textes: { fr: T; en: T; pt: T }): T {
  return textes[lireLangue(langue)];
}

/** Locale `Intl` de chaque langue, pour les dates et les nombres. */
export const LOCALE_INTL: Record<Langue, string> = {
  fr: "fr-FR",
  en: "en-GB",
  pt: "pt-PT",
};

export function localeIntl(langue: string): string {
  return LOCALE_INTL[lireLangue(langue)];
}

/** Nom de chaque langue, dans cette langue. */
export const NOM_LANGUE: Record<Langue, string> = {
  fr: "Français",
  en: "English",
  pt: "Português",
};
