import type { BoutonSection } from "./catalogue";

/**
 * Composition d'origine de la page d'accueil (§8.4).
 *
 * Décrite en **données** et non en JSX, pour servir deux usages à partir d'une
 * seule définition : le rendu de repli tant qu'aucune section n'existe, et la
 * matérialisation en base au moment où l'on en ajoute une première.
 *
 * Sans cette matérialisation, ajouter une section pour essayer effaçait la page
 * d'accueil entière — le rendu bascule sur les sections dès qu'il en existe
 * une. « Reprendre la main » doit vouloir dire « la page devient modifiable »,
 * pas « la page est vidée ».
 */
export interface SectionParDefaut {
  type: string;
  variant: string;
  sortOrder: number;
  settings: Record<string, unknown>;
  /** Clé du bloc éditorial dont provient chaque champ, quand il y en a un. */
  contenu: Record<string, { bloc?: string; fr?: string; en?: string }>;
}

const BOUTONS_ACCUEIL: BoutonSection[] = [
  { href: "/inscription", labelFr: "S'inscrire", labelEn: "Register", style: "principal" },
  {
    href: "/programme",
    labelFr: "Voir le programme",
    labelEn: "See the programme",
    style: "secondaire",
  },
  { href: "/mon-espace", labelFr: "Mon espace", labelEn: "My space", style: "secondaire" },
];

export const COMPOSITION_ACCUEIL: SectionParDefaut[] = [
  {
    type: "hero",
    variant: "avec-compteur",
    sortOrder: 10,
    settings: { boutons: BOUTONS_ACCUEIL },
    contenu: {
      titre: { bloc: "home.hero.title" },
      chapo: { bloc: "home.hero.lead" },
    },
  },
  {
    /*
     * La page « À propos » a été absorbée ici (§12).
     *
     * Son texte est le même bloc éditorial `about.body` : il se modifie
     * toujours en BackOffice, rubrique Contenus, et n'a pas été recopié — une
     * copie aurait divergé de l'original au premier ajustement.
     *
     * L'ancre `a-propos` donne à la section une adresse propre, vers laquelle
     * l'ancienne URL redirige.
     */
    type: "texte",
    variant: "adouci",
    sortOrder: 15,
    settings: { ancre: "a-propos" },
    contenu: {
      titre: { fr: "À propos du Forum", en: "About the Forum" },
      corps: { bloc: "about.body" },
    },
  },
  {
    type: "texte",
    variant: "clair",
    sortOrder: 20,
    settings: {},
    contenu: {
      titre: {},
      corps: { bloc: "home.objectives.intro" },
    },
  },
  {
    type: "actualites",
    variant: "cartes",
    sortOrder: 30,
    settings: { nombre: 3 },
    contenu: { titre: { fr: "Actualités", en: "News" } },
  },
];

/** Compositions par page. Une seule page est composable pour l'instant (T49). */
export const COMPOSITIONS: Record<string, SectionParDefaut[]> = {
  accueil: COMPOSITION_ACCUEIL,
};

/** Clés de blocs éditoriaux à charger pour construire une composition. */
export function blocsRequis(composition: SectionParDefaut[]): string[] {
  const cles = new Set<string>();
  for (const section of composition) {
    for (const champ of Object.values(section.contenu)) {
      if (champ.bloc) cles.add(champ.bloc);
    }
  }
  return [...cles];
}

/**
 * Résout les champs d'une section pour une langue donnée.
 *
 * `textes` porte les blocs éditoriaux déjà lus. Un bloc vide donne un champ
 * vide, ce que le rendu sait traiter — le bandeau retombe alors sur le titre de
 * l'édition, et le bloc de texte ne s'affiche pas du tout.
 */
export function resoudreContenu(
  section: SectionParDefaut,
  textes: Record<string, string>,
  langue: "fr" | "en",
): Record<string, string> {
  const resultat: Record<string, string> = {};
  for (const [cle, champ] of Object.entries(section.contenu)) {
    if (champ.bloc) resultat[cle] = textes[champ.bloc] ?? "";
    else resultat[cle] = (langue === "en" ? champ.en : champ.fr) ?? "";
  }
  return resultat;
}
