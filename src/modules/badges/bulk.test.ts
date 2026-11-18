import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, get, log } = vi.hoisted(() => ({
  findMany: vi.fn(),
  get: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { participant: { findMany } } }));
vi.mock("@/lib/storage", () => ({ fileStorage: { get } }));
vi.mock("@/lib/audit", () => ({ audit: { log } }));

import { exporterZip } from "./bulk";

/** Une ligne telle que la requête d'export la renvoie. */
function ligne(lastName: string, publicId: string, delegation: string | null) {
  return {
    publicId,
    firstName: "Awa",
    lastName,
    delegation: delegation ? { name: delegation } : null,
    badges: [{ pdfPath: `badges/${publicId}.pdf`, version: 1 }],
  };
}

/**
 * Lit les noms d'entrées d'une archive sans la décompresser : les en-têtes
 * locaux commencent par « PK\x03\x04 », et le nom suit à l'octet 30.
 */
function nomsDansArchive(archive: Buffer): string[] {
  const noms: string[] = [];
  for (let i = 0; i + 30 <= archive.length; i++) {
    if (archive.readUInt32LE(i) !== 0x04034b50) continue;
    const tailleNom = archive.readUInt16LE(i + 26);
    noms.push(archive.subarray(i + 30, i + 30 + tailleNom).toString("utf8"));
  }
  return noms;
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(Buffer.from("%PDF-1.4"));
  findMany.mockResolvedValue([
    ligne("diouf", "FID26-1", "Sénégal"),
    ligne("ndiaye", "FID26-2", null),
  ]);
});

/**
 * Le périmètre exporté ne change pas d'un rangement à l'autre : seuls les
 * chemins à l'intérieur de l'archive diffèrent. C'est ce qui permet de
 * promettre que les deux boutons donnent les mêmes badges.
 */
describe("rangement de l'archive", () => {
  it("range par délégation par défaut, « Sans delegation » compris", async () => {
    const archive = await exporterZip("e1", {}, "u1");

    expect(nomsDansArchive(archive.fichier)).toEqual([
      "Sénégal/DIOUF-Awa-FID26-1.pdf",
      "Sans delegation/NDIAYE-Awa-FID26-2.pdf",
    ]);
    expect(archive.inclus).toBe(2);
  });

  it("met les PDF côte à côte à plat, en gardant la délégation dans le nom", async () => {
    const archive = await exporterZip("e1", {}, "u1", "plat");

    const noms = nomsDansArchive(archive.fichier);
    expect(noms).toEqual([
      "Sénégal - DIOUF-Awa-FID26-1.pdf",
      "Sans delegation - NDIAYE-Awa-FID26-2.pdf",
    ]);
    // Aucun dossier : c'est tout l'objet de ce rangement.
    expect(noms.every((nom) => !nom.includes("/"))).toBe(true);
  });

  it("nomme l'archive différemment, pour ne pas confondre deux téléchargements", async () => {
    const parDelegation = await exporterZip("e1", {}, "u1");
    const aPlat = await exporterZip("e1", {}, "u1", "plat");

    expect(parDelegation.nom).not.toBe(aPlat.nom);
    expect(aPlat.nom).toMatch(/^badges-tous-\d{4}-\d{2}-\d{2}\.zip$/);
  });

  it("exporte le même nombre de badges dans les deux rangements", async () => {
    const parDelegation = await exporterZip("e1", {}, "u1");
    const aPlat = await exporterZip("e1", {}, "u1", "plat");

    expect(aPlat.inclus).toBe(parDelegation.inclus);
    expect(findMany.mock.calls[0]?.[0]).toEqual(findMany.mock.calls[1]?.[0]);
  });

  it("consigne le rangement dans le journal d'audit", async () => {
    await exporterZip("e1", {}, "u1", "plat");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "badge.bulk_export",
        after: expect.objectContaining({ rangement: "plat", inclus: 2 }),
      }),
    );
  });
});

/**
 * Un fichier absent du disque ne doit pas emporter l'export des autres : c'est
 * la règle d'`exporterZip`, et elle vaut pour les deux rangements.
 */
describe("badges manquants", () => {
  it("compte le PDF introuvable et poursuit", async () => {
    get.mockRejectedValueOnce(new Error("ENOENT"));

    const archive = await exporterZip("e1", {}, "u1", "plat");

    expect(archive.manquants).toBe(1);
    expect(archive.inclus).toBe(1);
    expect(nomsDansArchive(archive.fichier)).toEqual(["Sans delegation - NDIAYE-Awa-FID26-2.pdf"]);
  });
});
