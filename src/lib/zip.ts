import { crc32 } from "node:zlib";

/**
 * Écriture d'archives ZIP **sans compression** (méthode « stored »).
 *
 * Pourquoi pas une bibliothèque : le contenu à archiver est exclusivement des
 * PDF, déjà compressés — les recompresser coûterait du temps processeur pour
 * quelques pourcents. Il ne reste alors que l'assemblage du conteneur, qui tient
 * en une soixantaine de lignes, et cela évite de faire entrer un moteur de
 * compression dans le bundle serveur.
 *
 * Le format est celui de la spécification APPNOTE 6.3.4, dans son cas le plus
 * simple : tailles connues à l'avance, donc pas de descripteur de données ;
 * archives de quelques dizaines de mégaoctets, donc pas de ZIP64.
 *
 * L'archive produite est éprouvée par une **extraction réelle** dans les tests
 * de bout en bout, et non seulement par relecture de nos propres octets : un
 * conteneur que nous serions seuls à savoir lire ne servirait à rien.
 */
export interface EntreeZip {
  /** Chemin dans l'archive. Les séparateurs sont des `/`, y compris sous Windows. */
  nom: string;
  contenu: Buffer;
}

/** Bit 11 du drapeau général : les noms de fichiers sont en UTF-8. */
const DRAPEAU_UTF8 = 0x0800;
const METHODE_STOCKE = 0;

/**
 * Date et heure au format MS-DOS, hérité de 1980.
 *
 * Sans cela, certains extracteurs affichent une date invalide et Windows
 * refuse parfois d'ouvrir l'archive.
 */
function horodatageDos(date: Date): { heure: number; jour: number } {
  const annee = Math.max(date.getFullYear(), 1980);
  return {
    heure: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    jour: ((annee - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function creerZip(entrees: EntreeZip[], date: Date = new Date()): Buffer {
  const { heure, jour } = horodatageDos(date);
  const morceaux: Buffer[] = [];
  const central: Buffer[] = [];
  let decalage = 0;

  for (const entree of entrees) {
    const nom = Buffer.from(entree.nom, "utf8");
    const controle = crc32(entree.contenu);
    const taille = entree.contenu.length;

    const enTeteLocal = Buffer.alloc(30);
    enTeteLocal.writeUInt32LE(0x04034b50, 0); // signature d'en-tête local
    enTeteLocal.writeUInt16LE(20, 4); // version minimale : 2.0
    enTeteLocal.writeUInt16LE(DRAPEAU_UTF8, 6);
    enTeteLocal.writeUInt16LE(METHODE_STOCKE, 8);
    enTeteLocal.writeUInt16LE(heure, 10);
    enTeteLocal.writeUInt16LE(jour, 12);
    enTeteLocal.writeUInt32LE(controle, 14);
    enTeteLocal.writeUInt32LE(taille, 18); // taille compressée = taille brute
    enTeteLocal.writeUInt32LE(taille, 22);
    enTeteLocal.writeUInt16LE(nom.length, 26);
    enTeteLocal.writeUInt16LE(0, 28); // pas de champ « extra »

    morceaux.push(enTeteLocal, nom, entree.contenu);

    const enTeteCentral = Buffer.alloc(46);
    enTeteCentral.writeUInt32LE(0x02014b50, 0); // signature d'en-tête central
    enTeteCentral.writeUInt16LE(20, 4); // version d'écriture
    enTeteCentral.writeUInt16LE(20, 6); // version minimale de lecture
    enTeteCentral.writeUInt16LE(DRAPEAU_UTF8, 8);
    enTeteCentral.writeUInt16LE(METHODE_STOCKE, 10);
    enTeteCentral.writeUInt16LE(heure, 12);
    enTeteCentral.writeUInt16LE(jour, 14);
    enTeteCentral.writeUInt32LE(controle, 16);
    enTeteCentral.writeUInt32LE(taille, 20);
    enTeteCentral.writeUInt32LE(taille, 24);
    enTeteCentral.writeUInt16LE(nom.length, 28);
    enTeteCentral.writeUInt16LE(0, 30); // extra
    enTeteCentral.writeUInt16LE(0, 32); // commentaire
    enTeteCentral.writeUInt16LE(0, 34); // numéro de disque
    enTeteCentral.writeUInt16LE(0, 36); // attributs internes
    enTeteCentral.writeUInt32LE(0, 38); // attributs externes
    enTeteCentral.writeUInt32LE(decalage, 42);

    central.push(enTeteCentral, nom);
    decalage += enTeteLocal.length + nom.length + taille;
  }

  const repertoire = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); // signature de fin de répertoire central
  fin.writeUInt16LE(0, 4); // disque courant
  fin.writeUInt16LE(0, 6); // disque du répertoire
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(repertoire.length, 12);
  fin.writeUInt32LE(decalage, 16);
  fin.writeUInt16LE(0, 20); // longueur du commentaire

  return Buffer.concat([...morceaux, repertoire, fin]);
}

/**
 * Nom de fichier sûr dans une archive.
 *
 * Les accents et les espaces passent, mais ni les séparateurs de chemin ni les
 * caractères que Windows refuse : une archive dont un seul membre porte un `:`
 * ne s'extrait pas du tout, et l'erreur ne désigne pas le coupable.
 */
export function nomSur(valeur: string): string {
  return (
    valeur
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || "sans-nom"
  );
}
