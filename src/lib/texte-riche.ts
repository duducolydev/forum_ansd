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

export type BlocRiche = ParagrapheRiche | ListeRiche;

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

function nettoyerBlocs(brut: unknown, profondeur: number): BlocRiche[] {
  if (!Array.isArray(brut) || profondeur > PROFONDEUR_MAX) return [];
  const blocs: BlocRiche[] = [];

  for (const noeud of brut) {
    const type = champ(noeud, "type");
    const contenu = champ(noeud, "content");

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
          content: nettoyerBlocs(champ(element, "content"), profondeur + 1),
        }))
        .filter((element) => element.content.length > 0);
      if (elements.length > 0) blocs.push({ type, content: elements });
    } else if (type === "blockquote") {
      // Citation : le texte est gardé, la forme non.
      blocs.push(...nettoyerBlocs(contenu, profondeur + 1));
    }
  }

  return blocs;
}

/** Réduit un document quelconque à la liste fermée des nœuds et marques permis. */
export function nettoyerDoc(brut: unknown): DocRiche {
  if (champ(brut, "type") !== "doc") return vide();
  return { type: "doc", content: nettoyerBlocs(champ(brut, "content"), 0) };
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
export function lireTexteRiche(brut: string | null | undefined): DocRiche {
  const valeur = (brut ?? "").trim();
  if (!valeur) return vide();

  if (valeur.startsWith("{")) {
    try {
      const analyse: unknown = JSON.parse(valeur);
      if (champ(analyse, "type") === "doc") return nettoyerDoc(analyse);
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
  return blocs.flatMap((bloc) =>
    bloc.type === "paragraph"
      ? [enLigneVersTexte(bloc.content)]
      : bloc.content.flatMap((element) => blocsVersTexte(element.content)),
  );
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
