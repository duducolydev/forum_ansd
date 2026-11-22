import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, count, groupBy, updateMany, get, log } = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
  updateMany: vi.fn(),
  get: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { participant: { findMany, count }, badge: { updateMany, groupBy } },
}));
vi.mock("@/lib/storage", () => ({ fileStorage: { get } }));
vi.mock("@/lib/audit", () => ({ audit: { log } }));

import {
  aRefaireAuGabarit,
  badgesAImprimer,
  compterAImprimer,
  exporterSelection,
  exporterZip,
  joursExport,
  marquerExportes,
  perimetreFiltre,
} from "./bulk";

/** Une ligne telle que la requête d'export la renvoie. */
function ligne(lastName: string, publicId: string, delegation: string | null) {
  return {
    publicId,
    firstName: "Awa",
    lastName,
    delegation: delegation ? { name: delegation } : null,
    badges: [{ id: `b-${publicId}`, pdfPath: `badges/${publicId}.pdf`, version: 1 }],
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
  updateMany.mockResolvedValue({ count: 2 });
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

/**
 * Le marqueur « parti à l'impression » décide de ce que le prochain envoi
 * reprendra. Se tromper d'un côté fait réimprimer trois cents badges ; de
 * l'autre, quelqu'un se présente à l'accueil sans badge.
 */
describe("marquage des badges exportés", () => {
  it("marque les badges réellement emportés par l'archive", async () => {
    await exporterZip("e1", {}, "u1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b-FID26-1", "b-FID26-2"] } },
      data: { exportedAt: expect.any(Date), exportCount: { increment: 1 } },
    });
  });

  it("ne marque rien quand l'export est demandé sans marquage", async () => {
    await exporterZip("e1", {}, "u1", "delegation", false);

    expect(updateMany).not.toHaveBeenCalled();
  });

  it("ne marque pas un badge compté comme manquant", async () => {
    // Le PDF n'est pas sur le disque : il ne part pas, donc il reste à envoyer.
    get.mockRejectedValueOnce(new Error("ENOENT"));

    await exporterZip("e1", {}, "u1");

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["b-FID26-2"] } } }),
    );
  });

  it("n'écrit pas quand l'archive est vide", async () => {
    findMany.mockResolvedValue([]);

    const archive = await exporterZip("e1", {}, "u1");

    expect(archive.inclus).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

/**
 * La déclaration rétroactive : elle ne produit aucune archive, et ne doit
 * toucher que des badges qui existent vraiment.
 */
describe("déclaration d'un envoi passé", () => {
  it("marque le badge courant de chaque participant du filtre", async () => {
    const marques = await marquerExportes("e1", { delegationId: "d1" }, "u1");

    expect(marques).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b-FID26-1", "b-FID26-2"] } },
      data: { exportedAt: expect.any(Date), exportCount: { increment: 1 } },
    });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: "badge.marked_exported" }));
  });

  it("n'écrit rien quand le filtre ne désigne aucun badge rendu", async () => {
    findMany.mockResolvedValue([{ badges: [] }]);

    expect(await marquerExportes("e1", {}, "u1")).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});

/**
 * Le filtre d'export se croise avec celui d'état, et un croisement mal posé
 * répondrait à une question qu'on n'a pas posée.
 */
describe("filtre « envoi à l'impression »", () => {
  it("ne retient que les badges valides jamais exportés", () => {
    const ou = perimetreFiltre("e1", { export: "JAMAIS" });

    expect(ou.badges).toEqual({
      some: { revokedAt: null, generatedAt: { not: null }, exportedAt: null },
    });
  });

  it("se combine à l'état « généré » sans l'écraser", () => {
    const ou = perimetreFiltre("e1", { etat: "AVEC", export: "DEJA" });

    expect(ou.badges).toEqual({
      some: { revokedAt: null, generatedAt: { not: null }, exportedAt: { not: null } },
    });
  });

  it("laisse le filtre entier intact quand aucun envoi n'est demandé", () => {
    expect(perimetreFiltre("e1", {}).badges).toBeUndefined();
  });

  it("ne désigne personne pour « sans badge » et « déjà exporté »", () => {
    // Un badge qui n'existe pas ne peut pas être parti chez l'imprimeur : les
    // deux clauses se contredisent, et c'est exactement ce qu'on veut.
    const ou = perimetreFiltre("e1", { etat: "SANS", export: "DEJA" });

    expect(ou.badges).toMatchObject({
      none: expect.any(Object),
      some: { exportedAt: { not: null } },
    });
  });

  it("garde « sans badge » tel quel pour « pas encore exporté »", () => {
    const ou = perimetreFiltre("e1", { etat: "SANS", export: "JAMAIS" });

    expect(ou.badges).not.toHaveProperty("some");
  });
});

/**
 * Le jour d'export retrouve un envoi précis à l'imprimeur (22 novembre 2026).
 */
describe("filtre « exportés le »", () => {
  const jour = {
    gte: new Date("2026-11-21T00:00:00.000Z"),
    lt: new Date("2026-11-22T00:00:00.000Z"),
  };

  it("borne le dernier export au jour demandé, en UTC", () => {
    const ou = perimetreFiltre("e1", { exporteLe: "2026-11-21" });

    expect(ou.badges).toEqual({
      some: { revokedAt: null, generatedAt: { not: null }, exportedAt: jour },
    });
  });

  it("se combine à l'état « révoqué »", () => {
    const ou = perimetreFiltre("e1", { etat: "REVOQUE", exporteLe: "2026-11-21" });

    expect(ou.badges).toMatchObject({ some: { exportedAt: jour } });
  });

  it("ne désigne personne pour « sans badge »", () => {
    const ou = perimetreFiltre("e1", { etat: "SANS", exporteLe: "2026-11-21" });

    expect(ou.badges).toMatchObject({ none: expect.any(Object), some: { exportedAt: jour } });
  });
});

/**
 * La planche cumule son exigence d'image au périmètre du filtre. Étalée
 * par-dessus, elle écrasait la clé `badges` et imprimait tout le périmètre.
 */
describe("planche d'impression", () => {
  it("garde le filtre d'export en plus de l'exigence d'image", async () => {
    findMany.mockResolvedValue([]);
    await badgesAImprimer("e1", { exporteLe: "2026-11-21" }, 100, 200);

    const requete = findMany.mock.calls[0]![0];
    expect(requete.skip).toBe(200);
    expect(requete.take).toBe(100);
    expect(requete.where.AND).toEqual([
      perimetreFiltre("e1", { exporteLe: "2026-11-21" }),
      { badges: { some: { revokedAt: null, pngPath: { not: null } } } },
    ]);
  });

  it("finit l'ordre par l'identifiant, pour que les lots ne se chevauchent pas", async () => {
    findMany.mockResolvedValue([]);
    await badgesAImprimer("e1", {});

    expect(findMany.mock.calls[0]![0].orderBy.at(-1)).toEqual({ id: "asc" });
  });

  it("compte le total sur le même périmètre que les lots", async () => {
    count.mockResolvedValue(342);
    await expect(compterAImprimer("e1", { etat: "AVEC" })).resolves.toBe(342);

    expect(count.mock.calls[0]![0].where.AND[0]).toEqual(perimetreFiltre("e1", { etat: "AVEC" }));
  });

  it("regroupe les envois par jour, du plus récent au plus ancien", async () => {
    groupBy.mockResolvedValue([
      { exportedAt: new Date("2026-11-19T09:00:00.000Z"), _count: { _all: 394 } },
      { exportedAt: new Date("2026-11-21T08:00:00.000Z"), _count: { _all: 60 } },
      { exportedAt: new Date("2026-11-21T16:30:00.000Z"), _count: { _all: 40 } },
    ]);

    await expect(joursExport("e1", {})).resolves.toEqual([
      { jour: "2026-11-21", badges: 100 },
      { jour: "2026-11-19", badges: 394 },
    ]);
  });
});

describe("badges à refaire au gabarit", () => {
  it("garde le filtre d'export au lieu de l'écraser", () => {
    const ou = aRefaireAuGabarit("e1", { export: "JAMAIS" });

    expect(ou.AND).toHaveLength(2);
    expect((ou.AND as object[])[0]).toEqual(perimetreFiltre("e1", { export: "JAMAIS" }));
  });
});

describe("recherche par nom", () => {
  it("exige chaque mot dans le nom, le prénom ou l'identifiant", () => {
    const ou = perimetreFiltre("e1", { recherche: "awa  ndiaye" });

    expect(ou.AND).toEqual([
      {
        OR: [
          { lastName: { contains: "awa" } },
          { firstName: { contains: "awa" } },
          { publicId: { contains: "awa" } },
        ],
      },
      {
        OR: [
          { lastName: { contains: "ndiaye" } },
          { firstName: { contains: "ndiaye" } },
          { publicId: { contains: "ndiaye" } },
        ],
      },
    ]);
  });

  it("se cumule à la catégorie et à l'état", () => {
    const ou = perimetreFiltre("e1", { recherche: "diouf", categoryId: "c1", etat: "AVEC" });

    expect(ou.categoryId).toBe("c1");
    expect(ou.AND).toHaveLength(1);
    expect(ou.badges).toBeDefined();
  });

  it("n'ajoute rien sans recherche", () => {
    expect(perimetreFiltre("e1", { recherche: "   " })).not.toHaveProperty("AND");
  });
});

/**
 * Export des badges cochés sur la planche : des identifiants venus du
 * navigateur, donc à resserrer sur ce que l'édition autorise.
 */
describe("export d'une sélection", () => {
  it("ne lit que les badges choisis, valides et rendus, de l'édition active", async () => {
    await exporterSelection("e1", ["b-FID26-1", "b-FID26-2"], "u1");

    const requete = findMany.mock.calls[0]![0];
    expect(requete.where).toMatchObject({
      editionId: "e1",
      deletedAt: null,
      badges: { some: { id: { in: ["b-FID26-1", "b-FID26-2"] } } },
    });
    expect(requete.select.badges.where).toEqual({
      revokedAt: null,
      pdfPath: { not: null },
      id: { in: ["b-FID26-1", "b-FID26-2"] },
    });
  });

  it("met les PDF à plat par défaut, dans une archive nommée à part", async () => {
    const archive = await exporterSelection("e1", ["b-FID26-1", "b-FID26-2"], "u1");

    expect(archive.inclus).toBe(2);
    expect(archive.nom).toMatch(/^badges-selection-/);
    expect(nomsDansArchive(archive.fichier)).toEqual([
      "Sénégal - DIOUF-Awa-FID26-1.pdf",
      "Sans delegation - NDIAYE-Awa-FID26-2.pdf",
    ]);
  });

  it("compte manquant un identifiant écarté par la requête", async () => {
    // Trois badges demandés, deux retenus : le troisième a été révoqué entre-temps.
    const archive = await exporterSelection("e1", ["b-FID26-1", "b-FID26-2", "b-x"], "u1");

    expect(archive.inclus).toBe(2);
    expect(archive.manquants).toBe(1);
  });

  it("ignore un identifiant coché deux fois", async () => {
    const archive = await exporterSelection("e1", ["b-FID26-1", "b-FID26-1", "b-FID26-2"], "u1");

    expect(archive.manquants).toBe(0);
  });

  it("ne marque que sur demande", async () => {
    await exporterSelection("e1", ["b-FID26-1", "b-FID26-2"], "u1", "plat", false);
    expect(updateMany).not.toHaveBeenCalled();

    await exporterSelection("e1", ["b-FID26-1", "b-FID26-2"], "u1", "plat", true);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["b-FID26-1", "b-FID26-2"] } },
      data: { exportedAt: expect.any(Date), exportCount: { increment: 1 } },
    });
  });

  it("refuse une sélection vide ou démesurée", async () => {
    await expect(exporterSelection("e1", [], "u1")).rejects.toThrow(/Aucun badge/);
    const trop = Array.from({ length: 501 }, (_, i) => `b-${i}`);
    await expect(exporterSelection("e1", trop, "u1")).rejects.toThrow(/500/);
  });
});
