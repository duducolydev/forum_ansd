import { detectImageType } from "@/modules/participants/photo";

/**
 * Images **déposées par un agent** pour être publiées telles quelles.
 *
 * Deux usages à ce jour : le logo d'un partenaire et l'illustration d'une
 * section de page. Les deux partagent la même exigence — le fichier finit sur
 * le site public sans retraitement — et donc le même contrôle.
 *
 * Le SVG y est accepté, et **nulle part ailleurs**. Un logo institutionnel est
 * presque toujours livré en vectoriel : le refuser obligeait à demander une
 * conversion en PNG, avec la perte de netteté qui va avec, et c'est ce qui a
 * fait échouer le premier dépôt du logo de la Banque mondiale.
 *
 * La détection reste séparée de `detectImageType`, qui sert aux photos de
 * participants et aux badges : ces deux chemins passent par un traitement
 * d'image et par la génération de PDF, où un vectoriel n'aurait rien à faire.
 *
 * ## Pourquoi un SVG demande une vérification que PNG et JPEG ne demandent pas
 *
 * Un SVG est un document XML, pas un bitmap. Il peut porter du script, appeler
 * des ressources distantes, ou déclarer des entités qui font exploser
 * l'analyseur. Les trois sont neutralisés ici, et la route qui sert le fichier
 * ajoute ses propres en-têtes.
 *
 * Deux remarques pour qui relira ce code :
 *
 * - Chargé par `<img src>` — le seul usage qu'en fait le portail — un SVG
 *   n'exécute aucun script, dans tous les navigateurs modernes. Le risque
 *   résiduel tient à la navigation directe vers l'URL du fichier, et c'est
 *   celui-là que la route ferme.
 * - La vérification est faite **au dépôt**, une fois, plutôt qu'à chaque
 *   lecture : un fichier stocké est un fichier déjà jugé.
 */

export interface TypeImageDeposee {
  extension: string;
  type: string;
  /** Vrai pour le SVG, qui demande des en-têtes de service particuliers. */
  vectoriel: boolean;
}

/** Motifs refusés dans un SVG, avec la raison de chaque refus. */
const INTERDITS: { motif: RegExp; raison: string }[] = [
  { motif: /<\s*script/i, raison: "script" },
  { motif: /<\s*foreignObject/i, raison: "foreignObject" },
  { motif: /<\s*(iframe|embed|object)\b/i, raison: "document imbriqué" },
  { motif: /<!ENTITY/i, raison: "entité XML" },
  { motif: /<!DOCTYPE[^>]*\[/i, raison: "sous-ensemble DOCTYPE interne" },
  // Attribut d'événement : `onload=`, `onclick=`… Le `\s` en tête évite de
  // mordre sur un nom d'attribut légitime finissant par « on ».
  { motif: /\son[a-z]+\s*=/i, raison: "gestionnaire d'événement" },
  { motif: /javascript\s*:/i, raison: "URL javascript:" },
  { motif: /data\s*:\s*text\/html/i, raison: "data: HTML" },
  // Référence externe. Les fragments internes (`href="#degrade"`) restent
  // permis : ce sont eux qui servent aux dégradés et aux masques.
  { motif: /(xlink:)?href\s*=\s*["']\s*(?:https?:)?\/\//i, raison: "référence externe" },
];

export interface VerdictSvg {
  accepte: boolean;
  /** Motif du refus, destiné au message affiché à l'agent. */
  raison?: string;
}

/**
 * Juge un SVG sur son texte.
 *
 * Volontairement une liste de refus explicite plutôt qu'un nettoyage : un
 * assainisseur réécrit le fichier et laisse croire que tout est passé, alors
 * qu'un logo amputé de la moitié de ses balises est un défaut visible bien plus
 * tard. Ici, un fichier douteux est refusé et l'agent en connaît la raison.
 */
export function verifierSvg(texte: string): VerdictSvg {
  if (!/<\s*svg[\s>]/i.test(texte)) {
    return { accepte: false, raison: "le fichier ne contient pas de balise <svg>" };
  }
  const trouve = INTERDITS.find((interdit) => interdit.motif.test(texte));
  return trouve ? { accepte: false, raison: trouve.raison } : { accepte: true };
}

export interface ResultatImage {
  type?: TypeImageDeposee;
  /** Renseigné quand le fichier est refusé. */
  refus?: string;
}

/** Type réel du fichier, déduit des octets — jamais de l'extension ni du `Content-Type`. */
export function detecterImageDeposee(octets: Buffer): ResultatImage {
  const bitmap = detectImageType(octets);
  if (bitmap) {
    /*
     * Les champs sont recopiés un par un, sans diffusion de l'objet source :
     * `detectImageType` renvoie l'entrée complète de sa table de signatures,
     * fonction de test comprise. Le type déclaré la masquait, mais elle voyageait
     * bien dans l'objet — et se serait retrouvée sérialisée le jour où ce
     * résultat traverserait une frontière serveur/client.
     */
    return { type: { extension: bitmap.extension, type: bitmap.type, vectoriel: false } };
  }

  /*
   * Un SVG n'a pas de signature binaire : on le reconnaît à son texte. La
   * lecture est bornée pour ne pas décoder un fichier de plusieurs mégaoctets
   * qui ne serait de toute façon pas du XML.
   */
  const debut = octets.subarray(0, 1024).toString("utf8");
  const ressembleAuSvg = /<\s*svg[\s>]/i.test(debut) || /<\?xml/i.test(debut);
  if (!ressembleAuSvg) {
    return { refus: "Format d'image non reconnu (JPEG, PNG, WebP ou SVG)." };
  }

  const verdict = verifierSvg(octets.toString("utf8"));
  if (!verdict.accepte) {
    return { refus: `SVG refusé : ${verdict.raison}.` };
  }

  return { type: { extension: "svg", type: "image/svg+xml", vectoriel: true } };
}
