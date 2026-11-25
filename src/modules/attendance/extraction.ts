import { abregerCivilite, sexeDeCivilite } from "@/lib/civilite";
import type { FiltrePresence } from "./service";

/**
 * Filtres et extractions de la liste des présents (25 novembre 2026).
 *
 * Module **pur**, sans base ni dépendance serveur : l'écran le lit pour
 * filtrer à la frappe, la route d'extraction pour produire le fichier. Les deux
 * appliquent ainsi la même règle, et le fichier téléchargé contient exactement
 * ce que l'écran montrait — la leçon de la planche d'impression, qui avait un
 * jour oublié un filtre de l'écran Badges.
 *
 * ## Ce qu'on extrait
 *
 * - une **liste nominative**, aux colonnes choisies ;
 * - ou un **regroupement** — organisations, pays, catégories, civilités — avec, pour
 *   chacun, le nombre de présents et d'attendus. C'est la question posée après
 *   coup : « quelles organisations étaient là ? », « combien de pays ? ».
 */

/** Ce que filtrer et extraire demandent d'une ligne, quel que soit son côté. */
export interface LigneFiltrable {
  publicId: string;
  nom: string;
  /** Civilité telle que saisie ; absente des lignes construites sans elle. */
  civilite?: string | null;
  organisation: string | null;
  fonction: string | null;
  categorie: string;
  pays: string;
  /** Premier passage du jour (`Date` côté serveur, ISO côté écran), ou `null`. */
  premierPassage: Date | string | null;
}

export interface FiltresListePresents {
  presence: FiltrePresence;
  /** Libellé exact de la catégorie, tel qu'affiché. */
  categorie?: string;
  /** Pays, tel qu'affiché. */
  pays?: string;
  /** Clé d'organisation (`cleOrganisation`), pas le libellé. */
  organisation?: string;
  /** Clé de civilité (`cleCivilite`) : « Mme », « M. », « Dr »… ou `_`. */
  civilite?: string;
  /** Recherche libre : nom, organisation, fonction, identifiant. */
  recherche?: string;
}

/** Libellé des fiches sans organisation, en liste comme en regroupement. */
export const SANS_ORGANISATION = "Organisation non renseignée";
/** Clé de ces fiches : non vide, pour qu'un filtre « sans organisation » existe. */
export const CLE_SANS_ORGANISATION = "_";

/** Minuscules sans accents, pour que « goree » trouve « Gorée ». */
export function sansAccents(valeur: string): string {
  return valeur.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Clé de regroupement d'une organisation : sans accents, sans casse, espaces
 * resserrés. « ANSD », « Ansd » et « ansd  » sont une seule organisation ; les
 * saisies vraiment différentes (« ANSD » et « Agence nationale de la
 * statistique ») restent distinctes — l'harmonisation, elle, se fait en base.
 * `CLE_SANS_ORGANISATION` quand l'organisation n'est pas renseignée.
 */
export function cleOrganisation(organisation: string | null): string {
  return sansAccents((organisation ?? "").trim().replace(/\s+/g, " ")) || CLE_SANS_ORGANISATION;
}

/** Libellé des fiches sans civilité. */
export const SANS_CIVILITE = "Civilité non renseignée";
/** Clé de ces fiches, comme pour les organisations. */
export const CLE_SANS_CIVILITE = "_";

/**
 * Clé de civilité (25 novembre 2026) : l'abréviation française, qui réunit
 * « Madame », « Mme » et « Mrs » ; une saisie non reconnue reste telle quelle.
 * Il n'y a pas de champ « sexe » : c'est la civilité qui le dit, quand elle le
 * dit — « Mme » pour les femmes, « M. » pour les hommes.
 */
export function cleCivilite(civilite: string | null | undefined): string {
  return abregerCivilite(civilite, "fr") || CLE_SANS_CIVILITE;
}

/** Libellé d'une clé de civilité, le sexe précisé quand elle le dit. */
export function libelleCivilite(cle: string): string {
  if (cle === CLE_SANS_CIVILITE) return SANS_CIVILITE;
  if (cle === "Mme") return "Mme (femmes)";
  if (cle === "M.") return "M. (hommes)";
  return cle;
}

const ORDRE_CIVILITES = ["Mme", "M.", "Dr", "Pr", "SE"];

/**
 * Civilités présentes dans les lignes : Mme et M. d'abord, puis les titres,
 * les saisies libres, et « non renseignée » en dernier.
 */
export function civilitesDistinctes(
  lignes: Pick<LigneFiltrable, "civilite">[],
): { cle: string; libelle: string }[] {
  const rang = (cle: string) => {
    if (cle === CLE_SANS_CIVILITE) return ORDRE_CIVILITES.length + 1;
    const index = ORDRE_CIVILITES.indexOf(cle);
    return index === -1 ? ORDRE_CIVILITES.length : index;
  };
  return [...new Set(lignes.map((ligne) => cleCivilite(ligne.civilite)))]
    .sort((a, b) => rang(a) - rang(b) || a.localeCompare(b, "fr"))
    .map((cle) => ({ cle, libelle: libelleCivilite(cle) }));
}

/** Organisations distinctes des lignes : clé et libellé le plus fréquent. */
export function organisationsDistinctes(
  lignes: Pick<LigneFiltrable, "organisation">[],
): { cle: string; libelle: string }[] {
  const groupes = new Map<string, Map<string, number>>();
  for (const ligne of lignes) {
    const cle = cleOrganisation(ligne.organisation);
    const libelle = ligne.organisation?.trim().replace(/\s+/g, " ") || SANS_ORGANISATION;
    const variantes = groupes.get(cle) ?? new Map<string, number>();
    variantes.set(libelle, (variantes.get(libelle) ?? 0) + 1);
    groupes.set(cle, variantes);
  }
  return [...groupes.entries()]
    .map(([cle, variantes]) => ({ cle, libelle: plusFrequent(variantes) }))
    .sort((a, b) => {
      // « Non renseignée » en fin de liste, pas au milieu des A.
      if (a.cle === CLE_SANS_ORGANISATION) return 1;
      if (b.cle === CLE_SANS_ORGANISATION) return -1;
      return a.libelle.localeCompare(b.libelle, "fr");
    });
}

function plusFrequent(variantes: Map<string, number>): string {
  // À égalité, la première écriture rencontrée : le tri est stable.
  return [...variantes.entries()].sort((a, b) => b[1] - a[1])[0]![0];
}

/** Lignes retenues par les filtres, présence comprise. */
export function filtrerLignes<T extends LigneFiltrable>(
  lignes: T[],
  filtres: FiltresListePresents,
): T[] {
  return filtrerHorsPresence(lignes, filtres).filter((ligne) =>
    retenueParPresence(ligne, filtres.presence),
  );
}

/**
 * Lignes retenues par tous les filtres **sauf** la présence : la base des
 * regroupements, qui comptent présents et attendus côte à côte.
 */
export function filtrerHorsPresence<T extends LigneFiltrable>(
  lignes: T[],
  filtres: FiltresListePresents,
): T[] {
  const terme = sansAccents((filtres.recherche ?? "").trim());
  return lignes.filter((ligne) => {
    if (filtres.categorie && ligne.categorie !== filtres.categorie) return false;
    if (filtres.pays && ligne.pays !== filtres.pays) return false;
    if (filtres.organisation && cleOrganisation(ligne.organisation) !== filtres.organisation) {
      return false;
    }
    if (filtres.civilite && cleCivilite(ligne.civilite) !== filtres.civilite) return false;
    if (!terme) return true;
    return sansAccents(
      `${ligne.nom} ${ligne.organisation ?? ""} ${ligne.fonction ?? ""} ${ligne.publicId}`,
    ).includes(terme);
  });
}

function retenueParPresence(ligne: LigneFiltrable, presence: FiltrePresence): boolean {
  if (presence === "PRESENTS") return ligne.premierPassage !== null;
  if (presence === "ABSENTS") return ligne.premierPassage === null;
  return true;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export type TypeExtraction = "NOMINATIVE" | "ORGANISATIONS" | "PAYS" | "CATEGORIES" | "CIVILITES";

export const TYPES_EXTRACTION: { cle: TypeExtraction; libelle: string }[] = [
  { cle: "NOMINATIVE", libelle: "Liste nominative" },
  { cle: "ORGANISATIONS", libelle: "Organisations" },
  { cle: "PAYS", libelle: "Pays" },
  { cle: "CATEGORIES", libelle: "Catégories" },
  { cle: "CIVILITES", libelle: "Civilités / sexe" },
];

export type ColonneNominative =
  | "civilite"
  | "sexe"
  | "nom"
  | "identifiant"
  | "organisation"
  | "fonction"
  | "categorie"
  | "pays"
  | "entree"
  | "presence";

/** Colonnes proposées, dans l'ordre où elles sortent. */
export const COLONNES_NOMINATIVES: { cle: ColonneNominative; libelle: string }[] = [
  { cle: "civilite", libelle: "Civilité" },
  { cle: "nom", libelle: "Nom" },
  { cle: "sexe", libelle: "Sexe" },
  { cle: "identifiant", libelle: "Identifiant" },
  { cle: "organisation", libelle: "Organisation" },
  { cle: "fonction", libelle: "Fonction" },
  { cle: "categorie", libelle: "Catégorie" },
  { cle: "pays", libelle: "Pays" },
  { cle: "entree", libelle: "Heure d'entrée" },
  { cle: "presence", libelle: "Présence" },
];

export const COLONNES_PAR_DEFAUT: ColonneNominative[] = [
  "nom",
  "organisation",
  "fonction",
  "pays",
  "entree",
];

export function lireTypeExtraction(valeur: string | null | undefined): TypeExtraction {
  return TYPES_EXTRACTION.some((type) => type.cle === valeur)
    ? (valeur as TypeExtraction)
    : "NOMINATIVE";
}

/** Colonnes demandées (`nom,pays,…`), dans l'ordre canonique ; défaut si rien d'utile. */
export function lireColonnes(valeur: string | null | undefined): ColonneNominative[] {
  const demandees = new Set((valeur ?? "").split(","));
  const retenues = COLONNES_NOMINATIVES.map((colonne) => colonne.cle).filter((cle) =>
    demandees.has(cle),
  );
  return retenues.length > 0 ? retenues : COLONNES_PAR_DEFAUT;
}

/**
 * « présentes », « absents »… accordé au regroupement : organisations et
 * catégories au féminin, pays au masculin.
 */
export function qualificatifPresence(presence: FiltrePresence, feminin: boolean): string {
  if (presence === "TOUS") return "";
  const racine = presence === "PRESENTS" ? " présent" : " absent";
  return `${racine}${feminin ? "es" : "s"}`;
}

export interface Extraction {
  titre: string;
  colonnes: string[];
  lignes: (string | number)[][];
}

const HEURE = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function heure(passage: Date | string | null): string {
  return passage ? HEURE.format(new Date(passage)) : "";
}

/**
 * Construit l'extraction demandée à partir des lignes **non filtrées**.
 *
 * - Nominative : les lignes retenues par tous les filtres, aux colonnes choisies.
 * - Regroupements : un groupe figure s'il compte au moins une ligne retenue par
 *   tous les filtres — « organisations présentes » avec le filtre Présents —, et
 *   ses comptes portent sur toutes ses lignes hors filtre de présence : « 3
 *   présents sur 5 attendus » ne se lit qu'avec les deux nombres.
 */
export function construireExtraction(
  lignes: LigneFiltrable[],
  filtres: FiltresListePresents,
  type: TypeExtraction,
  colonnes: ColonneNominative[] = COLONNES_PAR_DEFAUT,
): Extraction {
  const qualificatif = qualificatifPresence(filtres.presence, type !== "PAYS");

  if (type === "NOMINATIVE") {
    const retenues = filtrerLignes(lignes, filtres);
    return {
      titre:
        filtres.presence === "PRESENTS"
          ? "Liste des présents"
          : filtres.presence === "ABSENTS"
            ? "Liste des absents"
            : "Liste de présence",
      colonnes: colonnes.map(
        (cle) => COLONNES_NOMINATIVES.find((colonne) => colonne.cle === cle)!.libelle,
      ),
      lignes: retenues.map((ligne) =>
        colonnes.map((cle) => {
          switch (cle) {
            case "civilite":
              return abregerCivilite(ligne.civilite, "fr");
            case "sexe": {
              const sexe = sexeDeCivilite(ligne.civilite);
              return sexe === "F" ? "Femme" : sexe === "H" ? "Homme" : "";
            }
            case "nom":
              return ligne.nom;
            case "identifiant":
              return ligne.publicId;
            case "organisation":
              return ligne.organisation ?? "";
            case "fonction":
              return ligne.fonction ?? "";
            case "categorie":
              return ligne.categorie;
            case "pays":
              return ligne.pays;
            case "entree":
              return heure(ligne.premierPassage);
            case "presence":
              return ligne.premierPassage ? "Présent" : "Absent";
          }
        }),
      ),
    };
  }

  const base = filtrerHorsPresence(lignes, filtres);
  const groupes = new Map<
    string,
    {
      variantes: Map<string, number>;
      pays: Set<string>;
      presents: number;
      attendus: number;
      retenu: boolean;
    }
  >();

  for (const ligne of base) {
    const cle =
      type === "ORGANISATIONS"
        ? cleOrganisation(ligne.organisation)
        : type === "PAYS"
          ? ligne.pays
          : type === "CIVILITES"
            ? cleCivilite(ligne.civilite)
            : ligne.categorie;
    const libelle =
      type === "ORGANISATIONS"
        ? ligne.organisation?.trim().replace(/\s+/g, " ") || SANS_ORGANISATION
        : type === "CIVILITES"
          ? libelleCivilite(cle)
          : cle || "Non renseigné";
    const groupe = groupes.get(cle) ?? {
      variantes: new Map<string, number>(),
      pays: new Set<string>(),
      presents: 0,
      attendus: 0,
      retenu: false,
    };
    groupe.variantes.set(libelle, (groupe.variantes.get(libelle) ?? 0) + 1);
    if (ligne.pays) groupe.pays.add(ligne.pays);
    groupe.attendus += 1;
    if (ligne.premierPassage) groupe.presents += 1;
    if (retenueParPresence(ligne, filtres.presence)) groupe.retenu = true;
    groupes.set(cle, groupe);
  }

  const retenus = [...groupes.values()]
    .filter((groupe) => groupe.retenu)
    .map((groupe) => ({ ...groupe, libelle: plusFrequent(groupe.variantes) }))
    .sort((a, b) => b.presents - a.presents || a.libelle.localeCompare(b.libelle, "fr"));

  const libelleType =
    type === "ORGANISATIONS"
      ? "Organisation"
      : type === "PAYS"
        ? "Pays"
        : type === "CIVILITES"
          ? "Civilité"
          : "Catégorie";
  const titre =
    type === "ORGANISATIONS"
      ? `Organisations${qualificatif}`
      : type === "PAYS"
        ? `Pays${qualificatif}`
        : type === "CIVILITES"
          ? titreCivilites(filtres.presence)
          : `Catégories${qualificatif}`;

  return {
    titre,
    colonnes:
      type === "ORGANISATIONS"
        ? [libelleType, "Pays", "Présents", "Attendus"]
        : [libelleType, "Présents", "Attendus"],
    lignes: retenus.map((groupe) =>
      type === "ORGANISATIONS"
        ? [
            groupe.libelle,
            [...groupe.pays].sort((a, b) => a.localeCompare(b, "fr")).join(", "),
            groupe.presents,
            groupe.attendus,
          ]
        : [groupe.libelle, groupe.presents, groupe.attendus],
    ),
  };
}

/** « Présents par civilité » : « Civilités présentes » ne se dirait pas. */
function titreCivilites(presence: FiltrePresence): string {
  const qui =
    presence === "PRESENTS" ? "Présents" : presence === "ABSENTS" ? "Absents" : "Attendus";
  return `${qui} par civilité`;
}
