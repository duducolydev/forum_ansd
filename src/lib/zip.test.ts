import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { creerZip, nomSur } from "./zip";

const DATE = new Date("2026-11-23T09:30:00.000Z");

/** Relecture minimale du répertoire central, pour vérifier ce qu'on a écrit. */
function lireRepertoire(archive: Buffer) {
  const finSignature = 0x06054b50;
  let position = archive.length - 22;
  while (position >= 0 && archive.readUInt32LE(position) !== finSignature) position--;
  expect(position, "fin de répertoire central introuvable").toBeGreaterThanOrEqual(0);

  const nombre = archive.readUInt16LE(position + 10);
  const debut = archive.readUInt32LE(position + 16);
  const noms: string[] = [];
  const tailles: number[] = [];

  let curseur = debut + archive.readUInt32LE(position + 12) - archive.readUInt32LE(position + 12);
  curseur = archive.length - 22 - archive.readUInt32LE(position + 12);

  for (let index = 0; index < nombre; index++) {
    expect(archive.readUInt32LE(curseur)).toBe(0x02014b50);
    const tailleNom = archive.readUInt16LE(curseur + 28);
    tailles.push(archive.readUInt32LE(curseur + 24));
    noms.push(archive.subarray(curseur + 46, curseur + 46 + tailleNom).toString("utf8"));
    curseur += 46 + tailleNom;
  }

  return { nombre, noms, tailles };
}

describe("archive ZIP (méthode stockée)", () => {
  it("écrit les signatures attendues", () => {
    const archive = creerZip([{ nom: "a.txt", contenu: Buffer.from("bonjour") }], DATE);

    // « PK\x03\x04 » en tête : c'est à cela qu'un extracteur reconnaît un ZIP.
    expect(archive.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(archive.readUInt32LE(archive.length - 22)).toBe(0x06054b50);
  });

  it("référence chaque entrée dans le répertoire central, avec sa taille", () => {
    const entrees = [
      { nom: "Mali/SOW-Aminata.pdf", contenu: Buffer.from("%PDF-1.4 aaa") },
      { nom: "Sans delegation/BA-Oumar.pdf", contenu: Buffer.alloc(2048, 7) },
    ];
    const { nombre, noms, tailles } = lireRepertoire(creerZip(entrees, DATE));

    expect(nombre).toBe(2);
    expect(noms).toEqual(entrees.map((entree) => entree.nom));
    expect(tailles).toEqual(entrees.map((entree) => entree.contenu.length));
  });

  it("calcule un CRC conforme au contenu", () => {
    const contenu = Buffer.from("%PDF-1.4 contenu de test");
    const archive = creerZip([{ nom: "x.pdf", contenu }], DATE);
    // Le CRC de l'en-tête local est à l'offset 14.
    expect(archive.readUInt32LE(14)).toBe(crc32(contenu));
  });

  it("marque les noms comme UTF-8", () => {
    const archive = creerZip(
      [{ nom: "Côte d'Ivoire/DIALLO.pdf", contenu: Buffer.from("x") }],
      DATE,
    );
    // Bit 11 du drapeau général : sans lui, les accents sortent en mojibake.
    expect(archive.readUInt16LE(6) & 0x0800).toBe(0x0800);
  });

  it("produit une archive vide lisible", () => {
    // Un filtre sans résultat ne doit pas produire un fichier corrompu.
    const archive = creerZip([], DATE);
    expect(archive).toHaveLength(22);
    expect(archive.readUInt16LE(8)).toBe(0);
  });
});

describe("assainissement des noms", () => {
  it("remplace ce que Windows refuse", () => {
    // Un seul membre avec « : » et l'archive entière refuse de s'extraire.
    expect(nomSur('SOW: "Aminata" <chef>')).toBe("SOW- -Aminata- -chef-");
  });

  it("écrase les séparateurs de chemin", () => {
    expect(nomSur("Mali/Bamako")).toBe("Mali-Bamako");
    expect(nomSur("a\\b")).toBe("a-b");
  });

  it("garde les accents", () => {
    expect(nomSur("Côte d'Ivoire")).toBe("Côte d'Ivoire");
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(nomSur("   ")).toBe("sans-nom");
    expect(nomSur("///")).toBe("---");
  });
});
