/**
 * Texte mis en forme des sections (PLAN.md §17).
 *
 * ## Pourquoi une structure et non du HTML
 *
 * L'éditeur (Tiptap) sait produire du HTML ; le stocker obligerait à le
 * nettoyer côté serveur avant chaque affichage, et un nettoyeur oublié ou
 * contourné laisse passer un `<img onerror>` sur la page d'accueil. Le texte est
 * donc stocké sous la forme d'un **document structuré** (JSON), réduit à une
 * liste fermée de nœuds et de marques, puis rendu élément par élément par
 * React, qui échappe le texte. Il n'existe aucun chemin par lequel une chaîne
 * saisie deviendrait du balisage.
 *
 * ## Ce qui est permis
 *
 * Paragraphes, sauts de ligne, listes à puces et numérotées ; gras, italique,
 * souligné et liens. Pas de titres : la section a déjà le sien, et un titre
 * glissé dans un paragraphe casserait la hiérarchie de la page — celle que
 * suivent les lecteurs d'écran. Un titre collé depuis un document devient un
 * paragraphe, sans perdre son texte.
 *
 * ## Compatibilité
 *
 * Les textes saisis avant l'éditeur sont du texte brut. Ils sont lus tels quels :
 * une ligne vide sépare deux paragraphes, un retour à la ligne devient un saut
 * de ligne — exactement ce que montrait l'affichage précédent.
 *
 * Module sans dépendance : il sert au serveur, à l'éditeur et aux tests.
 */

export type MarqueRiche =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "link"; attrs: { href: string } };

export type EnLigneRiche =
  { type: "text"; text: string; marks?: MarqueRiche[] } | { type: "hardBreak" };

export interface ParagrapheRiche {
  type: "paragraph";
  content?: EnLigneRiche[];
}

export interface ListeRiche {
  type: "bulletList" | "orderedList";
  content: ElementListeRiche[];
}

export interface ElementListeRiche {
  type: "listItem";
  content: BlocRiche[];
}

/**
 * Image insérée dans le corps (§34).
 *
 * `cle` est un **rang** dans la liste d'images de l'objet qui porte ce
 * document, jamais un chemin de fichier. C'est la même règle que pour les
 * images d'article : un chemin accepté depuis l'extérieur se transforme vite en
 * lecture arbitraire du volume de stockage. Le serveur résout le rang en URL au
 * moment du rendu.
 *
 * L'alignement et la largeur sont bornés par le nettoyage : une largeur libre
 * laisserait poser une image de 4 000 pixels dans une colonne de 700, et un
 * alignement libre finirait en attribut de style.
 */
export interface ImageRiche {
  type: "image";
  attrs: {
    cle: number;
    alt: string;
    alignement: "gauche" | "centre" | "droite";
    /** Pourcentage de la largeur de la colonne. */
    largeur: number;
  };
}

export type BlocRiche = ParagrapheRiche | ListeRiche | ImageRiche;

/** Largeurs proposées, et seules acceptées : quatre choix suffisent à composer. */
export const LARGEURS_IMAGE = [25, 50, 75, 100] as const;
export const ALIGNEMENTS_IMAGE = ["gauche", "centre", "droite"] as const;

export interface DocRiche {
  type: "doc";
  content: BlocRiche[];
}

/** Au-delà, des listes imbriquées ne servent plus un texte de section : on coupe. */
const PROFONDEUR_MAX = 6;

/** Limite du document sérialisé, balisage compris : de quoi tenir 3 000 caractères mis en forme. */
export const TAILLE_MAX_DOCUMENT = 20_000;

const vide = (): DocRiche => ({ type: "doc", content: [] });

function champ(objet: unknown, cle: string): unknown {
  return objet !== null && typeof objet === "object"
    ? (objet as Record<string, unknown>)[cle]
    : undefined;
}

/**
 * Adresse de lien acceptée : web (http, https), courriel, ou chemin interne.
 *
 * Tout le reste est refusé, `javascript:` en tête. Les chemins de la forme
 * `//hote` ou `/\hote` sont refusés aussi : un navigateur les résout vers un
 * autre site, alors qu'ils ont l'air internes.
 */
export function lienAutorise(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const valeur = href.trim();
  if (!valeur || valeur.length > 500) return null;
  if (/^https?:\/\/[^\s\\]+$/i.test(valeur)) return valeur;
  if (/^mailto:[^\s@\\]+@[^\s@\\]+$/i.test(valeur)) return valeur;
  if (/^\/(?![/\\])[^\s\\]*$/.test(valeur)) return valeur;
  return null;
}

function nettoyerMarques(brut: unknown): MarqueRiche[] | undefined {
  if (!Array.isArray(brut)) return undefined;
  const marques: MarqueRiche[] = [];
  const vues = new Set<string>();

  for (const marque of brut) {
    const type = champ(marque, "type");
    if (typeof type !== "string" || vues.has(type)) continue;

    if (type === "bold" || type === "italic" || type === "underline") {
      marques.push({ type });
      vues.add(type);
    } else if (type === "link") {
      const href = lienAutorise(champ(champ(marque, "attrs"), "href"));
      // Un lien refusé perd son lien, pas son texte.
      if (href) {
        marques.push({ type: "link", attrs: { href } });
        vues.add(type);
      }
    }
  }

  return marques.length > 0 ? marques : undefined;
}

function nettoyerEnLigne(brut: unknown): EnLigneRiche[] {
  if (!Array.isArray(brut)) return [];
  const resultat: EnLigneRiche[] = [];

  for (const noeud of brut) {
    const type = champ(noeud, "type");
    if (type === "text") {
      const text = champ(noeud, "text");
      if (typeof text !== "string" || text.length === 0) continue;
      const marks = nettoyerMarques(champ(noeud, "marks"));
      resultat.push(marks ? { type: "text", text, marks } : { type: "text", text });
    } else if (type === "hardBreak") {
      resultat.push({ type: "hardBreak" });
    }
  }

  return resultat;
}

/** Nœud image réduit à ses valeurs permises, ou `null` s'il n'en reste rien. */
function nettoyerImage(noeud: unknown): ImageRiche | null {
  const attrs = champ(noeud, "attrs");
  const cle = Number(champ(attrs, "cle"));
  // Un rang absent, négatif ou non entier ne désigne aucune image : le nœud
  // est écarté plutôt que rendu sur une image manquante.
  if (!Number.isInteger(cle) || cle < 0) return null;

  const alignementBrut = String(champ(attrs, "alignement") ?? "centre");
  const alignement = (ALIGNEMENTS_IMAGE as readonly string[]).includes(alignementBrut)
    ? (alignementBrut as ImageRiche["attrs"]["alignement"])
    : "centre";

  const largeurBrute = Number(champ(attrs, "largeur"));
  const largeur = (LARGEURS_IMAGE as readonly number[]).includes(largeurBrute) ? largeurBrute : 100;

  const altBrut = champ(attrs, "alt");
  // Alternative textuelle plafonnée : elle décrit une image, elle ne raconte
  // pas une histoire, et un texte sans fin dans un attribut sert surtout à
  // faire enfler le document.
  const alt = typeof altBrut === "string" ? altBrut.slice(0, 300) : "";

  return { type: "image", attrs: { cle, alt, alignement, largeur } };
}

function nettoyerBlocs(brut: unknown, profondeur: number, images: boolean): BlocRiche[] {
  if (!Array.isArray(brut) || profondeur > PROFONDEUR_MAX) return [];
  const blocs: BlocRiche[] = [];

  for (const noeud of brut) {
    const type = champ(noeud, "type");
    const contenu = champ(noeud, "content");

    if (type === "image") {
      // Hors newsletter, une image n'a pas de liste où puiser : le nœud est
      // simplement ignoré, et le reste du texte passe intact.
      if (images) {
        const image = nettoyerImage(noeud);
        if (image) blocs.push(image);
      }
      continue;
    }

    if (type === "paragraph" || type === "heading") {
      // Un titre devient un paragraphe : la section porte déjà son titre.
      const enLigne = nettoyerEnLigne(contenu);
      blocs.push(
        enLigne.length > 0 ? { type: "paragraph", content: enLigne } : { type: "paragraph" },
      );
    } else if (type === "bulletList" || type === "orderedList") {
      const elements: ElementListeRiche[] = (Array.isArray(contenu) ? contenu : [])
        .filter((element) => champ(element, "type") === "listItem")
        .map((element) => ({
          type: "listItem" as const,
          content: nettoyerBlocs(champ(element, "content"), profondeur + 1, images),
        }))
        .filter((element) => element.content.length > 0);
      if (elements.length > 0) blocs.push({ type, content: elements });
    } else if (type === "blockquote") {
      // Citation : le texte est gardé, la forme non.
      blocs.push(...nettoyerBlocs(contenu, profondeur + 1, images));
    }
  }

  return blocs;
}

/**
 * Réduit un document quelconque à la liste fermée des nœuds et marques permis.
 *
 * `images` est **désactivé par défaut** : seules les newsletters portent une
 * liste d'images où un rang trouve sa cible. Une section de page qui recevrait
 * un nœud image n'aurait rien à afficher, et l'autoriser partout aurait obligé
 * chaque rendu du site à savoir résoudre un rang qu'il n'a pas.
 */
export function nettoyerDoc(brut: unknown, options?: { images?: boolean }): DocRiche {
  if (champ(brut, "type") !== "doc") return vide();
  return {
    type: "doc",
    content: nettoyerBlocs(champ(brut, "content"), 0, options?.images ?? false),
  };
}

/** Lit un texte brut saisi avant l'éditeur : ligne vide = paragraphe, retour = saut de ligne. */
export function docDepuisTexteBrut(texte: string): DocRiche {
  const paragraphes = texte
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraphe) => paragraphe.replace(/^\n+|\n+$/g, ""))
    .filter((paragraphe) => paragraphe.trim().length > 0);

  return {
    type: "doc",
    content: paragraphes.map((paragraphe) => {
      const content: EnLigneRiche[] = [];
      paragraphe.split("\n").forEach((ligne, rang) => {
        if (rang > 0) content.push({ type: "hardBreak" });
        if (ligne) content.push({ type: "text", text: ligne });
      });
      return { type: "paragraph", content };
    }),
  };
}

/**
 * Lit la valeur stockée d'un champ mis en forme, quelle qu'elle soit : document
 * structuré, texte brut ancien, ou rien.
 */
export function lireTexteRiche(
  brut: string | null | undefined,
  options?: { images?: boolean },
): DocRiche {
  const valeur = (brut ?? "").trim();
  if (!valeur) return vide();

  if (valeur.startsWith("{")) {
    try {
      const analyse: unknown = JSON.parse(valeur);
      if (champ(analyse, "type") === "doc") return nettoyerDoc(analyse, options);
    } catch {
      // Un texte brut peut commencer par une accolade : il est lu comme tel.
    }
  }
  return docDepuisTexteBrut(brut ?? "");
}

function enLigneVersTexte(noeuds: EnLigneRiche[] | undefined): string {
  return (noeuds ?? []).map((noeud) => (noeud.type === "text" ? noeud.text : "\n")).join("");
}

function blocsVersTexte(blocs: BlocRiche[]): string[] {
  return blocs.flatMap((bloc) => {
    if (bloc.type === "paragraph") return [enLigneVersTexte(bloc.content)];
    /*
     * Une image ne compte pas dans la longueur du texte : son alternative
     * décrit ce qu'on voit, elle ne fait pas partie de ce qu'on écrit, et la
     * faire peser sur le plafond de caractères reviendrait à punir une
     * illustration bien décrite.
     */
    if (bloc.type === "image") return [];
    return bloc.content.flatMap((element) => blocsVersTexte(element.content));
  });
}

/** Texte sans mise en forme : ce qui se compte, et ce qui dit si le champ est vide. */
export function texteBrut(doc: DocRiche): string {
  return blocsVersTexte(doc.content).join("\n");
}

/**
 * Forme stockée d'un document. Un document sans texte vaut chaîne vide : sans
 * cela, un champ anglais « vidé » dans l'éditeur garderait une structure vide,
 * et le repli sur le français ne jouerait plus.
 */
export function serialiserTexteRiche(doc: DocRiche): string {
  return texteBrut(doc).trim() ? JSON.stringify(doc) : "";
}

/** Normalise une saisie et mesure sa longueur en caractères visibles. */
export function normaliserTexteRiche(brut: string): { valeur: string; longueur: number } {
  const doc = lireTexteRiche(brut);
  return { valeur: serialiserTexteRiche(doc), longueur: texteBrut(doc).length };
}
