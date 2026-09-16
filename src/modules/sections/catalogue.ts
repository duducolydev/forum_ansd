/**
 * Catalogue des types de sections (PLAN.md §8.4, arbitrage C15).
 *
 * Fermé et non extensible depuis l'interface : chaque type est un composant
 * rendu, testé et accessible, et chaque « variante » une présentation vérifiée.
 * C'est le contraire d'un moteur de mise en page, et c'est délibéré — un
 * emplacement libre produit des pages cassées sur téléphone bien avant de
 * produire des pages réussies, et un style libre défait les contrastes calculés.
 *
 * Ajouter un type revient à ajouter une entrée ici **et** son rendu : les deux
 * vont de pair, ce que le test du catalogue vérifie.
 */

/**
 * `court` et `long` : texte brut. `riche` : texte mis en forme dans l'éditeur
 * (gras, italique, souligné, listes, liens, sauts de ligne — PLAN.md §17), dont
 * `max` compte les caractères visibles et non le balisage.
 */
export type TypeChampContenu = "court" | "long" | "riche";

export interface ChampContenu {
  cle: string;
  label: string;
  type: TypeChampContenu;
  max: number;
  /** Aide affichée sous le champ, quand la consigne n'est pas évidente. */
  aide?: string;
}

export interface OptionChoix {
  cle: string;
  label: string;
}

export type ChampReglage =
  | { cle: string; label: string; type: "booleen"; defaut: boolean; aide?: string }
  | {
      cle: string;
      label: string;
      type: "nombre";
      min: number;
      max: number;
      defaut: number;
      aide?: string;
    }
  | { cle: string; label: string; type: "boutons"; max: number; aide?: string }
  | { cle: string; label: string; type: "ancre"; aide?: string }
  | { cle: string; label: string; type: "image"; aide?: string }
  | {
      cle: string;
      label: string;
      type: "choix";
      options: OptionChoix[];
      defaut: string;
      aide?: string;
    };

export interface Variante {
  cle: string;
  label: string;
}

export interface TypeSection {
  cle: string;
  label: string;
  description: string;
  variantes: Variante[];
  champs: ChampContenu[];
  reglages: ChampReglage[];
  /** Données à charger pour rendre ce type : évite une requête par section. */
  besoins: Besoin[];
}

export type Besoin = "stats" | "actualites" | "sponsors" | "intervenants" | "sessions";

/** Un bouton d'appel à l'action, tel que stocké dans les réglages d'une section. */
export interface BoutonSection {
  href: string;
  labelFr: string;
  labelEn: string;
  style: "principal" | "secondaire";
}

/**
 * Fonds proposés aux sections de texte.
 *
 * « Sombre » ne pose pas de couleurs à la main : la section passe dans le thème
 * sombre du site (`data-theme="dark"`), dont chaque couple texte/fond est déjà
 * mesuré, sur un fond plus foncé que le fond adouci (`--fond-sombre`). Le
 * contraste de ce fond est vérifié par `palette.test.ts`, dans les deux thèmes.
 */
const VARIANTES_FOND: Variante[] = [
  { cle: "clair", label: "Fond clair" },
  { cle: "adouci", label: "Fond adouci" },
  { cle: "sombre", label: "Fond sombre" },
];

const AIDE_ALT =
  "Ce que montre l'image, pour qui ne la voit pas. Laisser vide si elle est purement décorative.";

const TYPES: TypeSection[] = [
  {
    cle: "hero",
    label: "Bandeau d'accueil",
    description:
      "Le premier écran : dates, titre, texte d'introduction et boutons. La variante avec compteur ajoute le décompte et les chiffres en direct.",
    variantes: [
      { cle: "avec-compteur", label: "Avec compteur et chiffres en direct" },
      { cle: "simple", label: "Texte seul, sans panneau" },
    ],
    champs: [
      { cle: "titre", label: "Titre principal", type: "court", max: 160 },
      { cle: "chapo", label: "Texte d'introduction", type: "riche", max: 400 },
      {
        cle: "imageAlt",
        label: "Texte alternatif de l'illustration",
        type: "court",
        max: 160,
        aide: AIDE_ALT,
      },
    ],
    reglages: [
      {
        cle: "boutons",
        label: "Boutons",
        type: "boutons",
        max: 3,
        aide: "Le premier est mis en avant, les suivants sont secondaires.",
      },
    ],
    besoins: ["stats"],
  },
  {
    cle: "texte",
    label: "Bloc de texte",
    description: "Un titre facultatif et un paragraphe. Pour présenter, situer, expliquer.",
    variantes: VARIANTES_FOND,
    champs: [
      { cle: "titre", label: "Titre (facultatif)", type: "court", max: 120 },
      { cle: "corps", label: "Texte", type: "riche", max: 3000 },
      {
        cle: "imageAlt",
        label: "Texte alternatif de l'illustration",
        type: "court",
        max: 160,
        aide: AIDE_ALT,
      },
    ],
    reglages: [],
    besoins: [],
  },
  {
    cle: "chiffres",
    label: "Chiffres clés",
    description:
      "Compteurs calculés en direct depuis la base : participants confirmés, pays, sessions publiées, intervenants, journées.",
    variantes: [
      { cle: "cartes", label: "En cartes" },
      { cle: "bandeau", label: "En bandeau" },
    ],
    champs: [{ cle: "titre", label: "Titre (facultatif)", type: "court", max: 120 }],
    reglages: [
      { cle: "participants", label: "Participants confirmés", type: "booleen", defaut: true },
      { cle: "pays", label: "Nombre de pays", type: "booleen", defaut: true },
      { cle: "sessions", label: "Sessions publiées", type: "booleen", defaut: true },
      { cle: "intervenants", label: "Intervenants publiés", type: "booleen", defaut: true },
      { cle: "jours", label: "Nombre de journées", type: "booleen", defaut: false },
    ],
    besoins: ["stats"],
  },
  {
    cle: "actualites",
    label: "Dernières actualités",
    description: "Les articles publiés les plus récents, avec leur couverture et leur chapô.",
    variantes: [
      { cle: "cartes", label: "En cartes" },
      { cle: "liste", label: "En liste" },
    ],
    champs: [{ cle: "titre", label: "Titre de la section", type: "court", max: 120 }],
    reglages: [
      { cle: "nombre", label: "Nombre d'articles", type: "nombre", min: 1, max: 6, defaut: 3 },
    ],
    besoins: ["actualites"],
  },
  {
    cle: "programme",
    label: "Aperçu du programme",
    description: "Les sessions publiées à la une, groupées par journée.",
    variantes: [{ cle: "jours", label: "Groupé par journée" }],
    champs: [{ cle: "titre", label: "Titre de la section", type: "court", max: 120 }],
    reglages: [
      { cle: "nombre", label: "Sessions affichées", type: "nombre", min: 1, max: 12, defaut: 6 },
    ],
    besoins: ["sessions"],
  },
  {
    cle: "intervenants",
    label: "Intervenants",
    description: "Les intervenants publiés, avec leur photo et leur fonction.",
    variantes: [{ cle: "grille", label: "En grille" }],
    champs: [{ cle: "titre", label: "Titre de la section", type: "court", max: 120 }],
    reglages: [
      { cle: "nombre", label: "Intervenants affichés", type: "nombre", min: 2, max: 12, defaut: 8 },
    ],
    besoins: ["intervenants"],
  },
  {
    cle: "sponsors",
    label: "Partenaires",
    description: "Les partenaires publiés, groupés par niveau de partenariat.",
    variantes: [
      { cle: "grille", label: "En grille" },
      { cle: "bandeau", label: "En bandeau compact" },
    ],
    champs: [{ cle: "titre", label: "Titre de la section", type: "court", max: 120 }],
    reglages: [],
    besoins: ["sponsors"],
  },
  {
    cle: "appel",
    label: "Appel à l'action",
    description: "Un titre, une phrase et un ou deux boutons. Pour conclure une page.",
    variantes: VARIANTES_FOND,
    champs: [
      { cle: "titre", label: "Titre", type: "court", max: 120 },
      { cle: "corps", label: "Phrase d'accompagnement", type: "riche", max: 400 },
      {
        cle: "imageAlt",
        label: "Texte alternatif de l'illustration",
        type: "court",
        max: 160,
        aide: AIDE_ALT,
      },
    ],
    reglages: [{ cle: "boutons", label: "Boutons", type: "boutons", max: 2 }],
    besoins: [],
  },
];

/**
 * Illustration de section.
 *
 * Réservée aux types qui ont une place pour elle : le bandeau d'ouverture, le
 * bloc de texte et l'appel à l'action. Une illustration sur les actualités, les
 * intervenants ou les partenaires n'aurait nulle part où aller — ces types
 * portent déjà leurs propres visuels, et en ajouter un troisième ne ferait
 * qu'encombrer.
 *
 * Le fichier n'est pas dans le contenu mais dans les réglages : une image ne se
 * traduit pas. Son **texte alternatif**, si, et il vit donc dans les champs de
 * contenu, une version par langue.
 */
export const REGLAGE_IMAGE: ChampReglage = {
  cle: "image",
  label: "Illustration",
  type: "image",
  aide: "SVG, PNG, JPEG ou WebP. Choisissez le fichier puis enregistrez la section.",
};

/**
 * Côté de l'illustration par rapport au texte.
 *
 * Seule la disposition change : dans la page, le texte vient toujours avant
 * l'image, si bien qu'un lecteur d'écran lit la même chose dans les deux cas.
 * Sur téléphone, où les deux s'empilent, le réglage ne s'applique pas — une
 * colonne n'a pas de côté.
 */
export const REGLAGE_POSITION_IMAGE: ChampReglage = {
  cle: "positionImage",
  label: "Position de l'illustration",
  type: "choix",
  options: [
    { cle: "droite", label: "À droite du texte" },
    { cle: "gauche", label: "À gauche du texte" },
  ],
  defaut: "droite",
  aide: "Sur téléphone, l'illustration passe sous le texte.",
};

/** Types auxquels une illustration apporte quelque chose. */
const TYPES_ILLUSTRABLES = new Set(["hero", "texte", "appel"]);

/**
 * Ancre de section, commune à **tous** les types.
 *
 * Elle donne à une section une adresse propre : `/#a-propos` amène directement
 * dessus. C'est ce qui permet de fondre une page entière dans l'accueil sans
 * casser les liens qui pointaient vers elle — la page « À propos » a été
 * absorbée ainsi.
 *
 * Le réglage est **déclaré** plutôt que posé en douce dans les données : la
 * normalisation ne conserve que les réglages du type, et une ancre non déclarée
 * disparaîtrait à la première modification de la section en BackOffice, sans
 * que rien ne le signale.
 */
export const REGLAGE_ANCRE: ChampReglage = {
  cle: "ancre",
  label: "Ancre (lien direct)",
  type: "ancre",
  aide: "Lettres, chiffres et tirets. Un lien vers /#ancre amène sur cette section.",
};

/*
 * L'ancre est ajoutée ici, une fois, plutôt que recopiée dans chaque type :
 * un type ajouté demain l'aura sans que personne ait à y penser. Même principe
 * pour l'illustration et sa position, sur les types illustrables.
 */
export const CATALOGUE: TypeSection[] = TYPES.map((type) => ({
  ...type,
  reglages: [
    ...type.reglages,
    ...(TYPES_ILLUSTRABLES.has(type.cle) ? [REGLAGE_IMAGE, REGLAGE_POSITION_IMAGE] : []),
    REGLAGE_ANCRE,
  ],
}));

export const CLES_TYPES = CATALOGUE.map((type) => type.cle);

export function typeSection(cle: string): TypeSection | undefined {
  return CATALOGUE.find((type) => type.cle === cle);
}

/** Réglages par défaut d'un type, tels que l'écran de création les propose. */
export function reglagesParDefaut(cle: string): Record<string, unknown> {
  const type = typeSection(cle);
  if (!type) return {};

  const reglages: Record<string, unknown> = {};
  for (const champ of type.reglages) {
    if (champ.type === "booleen") reglages[champ.cle] = champ.defaut;
    else if (champ.type === "nombre") reglages[champ.cle] = champ.defaut;
    else if (champ.type === "choix") reglages[champ.cle] = champ.defaut;
    else reglages[champ.cle] = [];
  }
  return reglages;
}

/** Union des données nécessaires : une seule passe de chargement par page. */
export function besoinsDe(types: readonly string[]): Set<Besoin> {
  const besoins = new Set<Besoin>();
  for (const cle of types) {
    for (const besoin of typeSection(cle)?.besoins ?? []) besoins.add(besoin);
  }
  return besoins;
}

/** Pages composables. Les autres restent écrites en dur, faute de raison d'en changer. */
export const PAGES = [{ cle: "accueil", label: "Page d'accueil", chemin: "/" }] as const;

export type ClePage = (typeof PAGES)[number]["cle"];
