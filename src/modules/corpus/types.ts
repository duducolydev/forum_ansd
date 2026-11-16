import type { Langue } from "@/lib/langue";

/**
 * Corpus public du portail, pour l'assistant de recherche interne (16 novembre
 * 2026).
 *
 * ## Pourquoi un export, et non un accès à la base
 *
 * Le contenu public est réparti sur une quinzaine de tables, en trois langues,
 * chacune portant son propre drapeau de publication, et les textes longs y sont
 * stockés en **document structuré** et non en HTML (`lib/texte-riche.ts`). Un
 * indexeur branché sur MySQL devrait donc rejouer toutes ces règles — et la
 * première oubliée publie un brouillon. L'application les connaît déjà : elle
 * les applique ici une fois pour toutes et ne livre que du texte lisible.
 *
 * ## Ce que l'export ne contient pas
 *
 * Aucune donnée personnelle de participant : ni nom, ni adresse, ni téléphone,
 * ni badge, ni présence, ni inscription à une session. Les seules personnes
 * nommées sont les **intervenants publiés**, qui le sont déjà sur le site.
 * Cette règle n'est pas une précaution de rédaction : les tables concernées ne
 * sont pas lues par ce module, et le test `construire.test.ts` le vérifie.
 */

export type TypeDocument =
  | "repere"
  | "bloc"
  | "section"
  | "session"
  | "intervenant"
  | "actualite"
  | "newsletter"
  | "rubrique"
  | "hotel"
  | "contact"
  | "partenaire"
  | "album"
  | "contribution";

/**
 * Une unité de réponse : un contenu, et l'adresse de la page qui le porte.
 *
 * Un document par langue plutôt qu'un document à trois champs : l'assistant
 * répond dans la langue du visiteur, et un index trilingue mélangé renvoie des
 * extraits dans la mauvaise langue.
 */
export interface DocumentCorpus {
  /** Stable d'un export à l'autre : `<type>:<identifiant>:<langue>`. */
  id: string;
  type: TypeDocument;
  langue: Langue;
  /**
   * Chemin de la page, ancre comprise quand le contenu n'est qu'une partie
   * d'une page longue. Relatif : c'est `base` qui porte l'origine, pour qu'un
   * index construit en recette reste utilisable en production.
   */
  url: string;
  titre: string;
  /** Chapô ou accroche. Vide quand le contenu n'en a pas. */
  resume: string;
  /** Corps, sans mise en forme : ce qui s'indexe et ce qui se cite. */
  texte: string;
  /**
   * Faits à citer tels quels plutôt qu'à reformuler : horaire, salle, prix,
   * distance, téléphone. Un assistant qui paraphrase un horaire se trompe d'une
   * demi-heure ; avec le fait sous la main, il le recopie.
   */
  donnees?: Record<string, string | number>;
  /**
   * La page demande une connexion. L'assistant ne cherche pas à répondre : il
   * renvoie vers `/connexion`. Concerne « où est mon badge », « suis-je inscrit
   * à telle session », « mon attestation » — dont les réponses sont par
   * définition propres à une personne, et n'ont rien à faire dans un index.
   */
  connexionRequise?: boolean;
  /** Dernière écriture connue, en ISO 8601. Permet une réindexation partielle. */
  maj: string;
}

export interface Corpus {
  /**
   * Version du format. À incrémenter si la forme d'un document change d'une
   * manière qui casse un indexeur déjà écrit — l'ajout d'un champ n'en est pas une.
   */
  version: 1;
  /** Origine publique du portail, à préfixer aux `url` pour obtenir un lien cliquable. */
  base: string;
  edition: {
    code: string;
    titre: string;
    theme: string | null;
    debut: string;
    fin: string;
    lieu: string;
    ville: string;
  };
  /** Horodatage de l'export, pour savoir de quand datent les réponses. */
  genere: string;
  langues: Langue[];
  nombre: number;
  documents: DocumentCorpus[];
}
