import { lireTexteRiche, type BlocRiche, type EnLigneRiche } from "./texte-riche";

/**
 * Découpe un texte riche en mots, pour `ScrubText` (brief « Constellation »
 * §4.2) : le texte s'allume mot à mot au défilement.
 *
 * Les **mots clés** sont ceux que le comité a mis en gras ou en italique dans
 * l'éditeur : ils passent en vert gras en s'allumant. Rien n'est donc codé en
 * dur dans le composant — mettre « ANSD » en gras suffit à en faire un mot
 * clé.
 *
 * Les listes deviennent des paragraphes ; un lien reste un lien, mot par mot.
 * Fonction pure, appelée côté serveur : le client reçoit des mots, jamais de
 * HTML à injecter.
 */

export interface MotScrub {
  mot: string;
  cle: boolean;
  lien?: string;
}

export type ParagrapheScrub = MotScrub[];

function motsEnLigne(noeuds: EnLigneRiche[] | undefined): MotScrub[] {
  const mots: MotScrub[] = [];
  for (const noeud of noeuds ?? []) {
    if (noeud.type !== "text") continue;
    const marques = noeud.marks ?? [];
    const cle = marques.some((marque) => marque.type === "bold" || marque.type === "italic");
    const lien = marques.find((marque) => marque.type === "link");
    for (const mot of noeud.text.split(/\s+/)) {
      if (!mot) continue;
      mots.push({ mot, cle, ...(lien && lien.type === "link" ? { lien: lien.attrs.href } : {}) });
    }
  }
  return mots;
}

function paragraphes(blocs: BlocRiche[]): ParagrapheScrub[] {
  const resultat: ParagrapheScrub[] = [];
  for (const bloc of blocs) {
    if (bloc.type === "paragraph") {
      const mots = motsEnLigne(bloc.content);
      if (mots.length > 0) resultat.push(mots);
    } else if (bloc.type === "bulletList" || bloc.type === "orderedList") {
      for (const element of bloc.content) resultat.push(...paragraphes(element.content));
    }
  }
  return resultat;
}

export function motsDeTexteRiche(valeur: string): ParagrapheScrub[] {
  return paragraphes(lireTexteRiche(valeur).content);
}
