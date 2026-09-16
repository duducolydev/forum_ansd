import { deflateSync } from "node:zlib";

/**
 * Fabrique un PNG valide en mémoire.
 *
 * Les tests ont besoin d'une **vraie** image : le champ photo la décode dans un
 * canvas pour la recadrer, et un fichier bidon ne franchirait pas cette étape.
 * Plutôt que de versionner un binaire, on en compose un — quelques dizaines de
 * lignes, et le contenu reste lisible dans le dépôt.
 */
export function pngUni(largeur: number, hauteur: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });

  const crc32 = (donnees: Buffer): number => {
    let c = 0xffffffff;
    for (const octet of donnees) c = crcTable[(c ^ octet) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const bloc = (type: string, donnees: Buffer): Buffer => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
    const controle = Buffer.alloc(4);
    controle.writeUInt32BE(crc32(corps));
    return Buffer.concat([longueur, corps, controle]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largeur, 0);
  ihdr.writeUInt32BE(hauteur, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // couleur vraie, sans alpha
  ihdr[10] = 0; // compression standard
  ihdr[11] = 0; // filtrage standard
  ihdr[12] = 0; // pas d'entrelacement

  // Chaque ligne est précédée de son octet de filtre (0 = aucun).
  const lignes: Buffer[] = [];
  for (let y = 0; y < hauteur; y++) {
    const ligne = Buffer.alloc(1 + largeur * 3);
    for (let x = 0; x < largeur; x++) {
      ligne[1 + x * 3] = rgb[0];
      ligne[2 + x * 3] = rgb[1];
      ligne[3 + x * 3] = rgb[2];
    }
    lignes.push(ligne);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", deflateSync(Buffer.concat(lignes))),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}
