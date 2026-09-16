import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, test } from "@playwright/test";
import { prisma } from "../src/lib/db";
import { fileStorage } from "../src/lib/storage";
import { seConnecterAdmin } from "./helpers/comptes";

/**
 * Poids des illustrations de section.
 *
 * Ce parcours existe parce qu'il a échoué en vrai. Les Server Actions de Next
 * acceptent 3 Mo ; au-delà, la plateforme rejette **avant** tout code
 * applicatif : ni image enregistrée, ni message affiché, l'écran ne bouge pas.
 * Or une photographie d'appareil pèse couramment 4 à 8 Mo — le cas normal
 * tombait dans la zone silencieuse. Le navigateur réduit désormais l'image
 * avant l'envoi.
 *
 * Le test travaille sur **sa propre section**, créée puis supprimée. La
 * première version se servait d'une section existante : elle aurait écrasé son
 * illustration, et le service supprime le fichier remplacé — le test aurait
 * donc détruit une photographie déposée par un agent.
 */

test.describe.configure({ timeout: 240_000 });

test.afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * PNG de bruit, volontairement gros.
 *
 * De **vrais** octets aléatoires : la première version utilisait un générateur
 * congruentiel maison dont les multiplications dépassaient la précision des
 * entiers de JavaScript. La suite dégénérait, se compressait très bien, et
 * l'image pesait 835 Ko au lieu des 3 Mo visés — elle ne testait donc rien.
 */
function pngBruite(cote: number): Buffer {
  const lignes: Buffer[] = [];
  for (let y = 0; y < cote; y++) {
    lignes.push(Buffer.concat([Buffer.alloc(1), randomBytes(cote * 3)]));
  }
  // Niveau 0 : la taille est garantie au lieu d'être espérée.
  const brut = deflateSync(Buffer.concat(lignes), { level: 0 });

  const crc32 = (buf: Buffer): number => {
    let c = ~0;
    for (const octet of buf) {
      c ^= octet;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c;
  };
  const bloc = (type: string, donnees: Buffer) => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const corps = Buffer.concat([Buffer.from(type, "ascii"), donnees]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corps) >>> 0);
    return Buffer.concat([longueur, corps, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cote, 0);
  ihdr.writeUInt32BE(cote, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloc("IHDR", ihdr),
    bloc("IDAT", brut),
    bloc("IEND", Buffer.alloc(0)),
  ]);
}

test("une photographie de plusieurs mégaoctets est déposée sans rien perdre en route", async ({
  page,
}) => {
  const gros = pngBruite(1200);
  expect(gros.length, "l'image de test doit dépasser la limite des Server Actions").toBeGreaterThan(
    3 * 1024 * 1024,
  );

  await seConnecterAdmin(page);
  await page.goto("/admin/parametres/sections");

  // Section à soi : on n'écrase l'illustration de personne.
  await page.getByLabel("Type").selectOption("appel");
  await page.getByRole("button", { name: "Ajouter" }).click();
  await expect(page.getByText(/Section ajoutée/)).toBeVisible();

  const carte = page.locator('[data-testid="carte-section"][data-type="appel"]').last();
  const sectionId = await carte.getAttribute("data-id");

  try {
    await carte.locator('input[type="file"]').setInputFiles({
      name: "photo-cicad.png",
      mimeType: "image/png",
      buffer: gros,
    });

    // Le navigateur annonce ce qu'il a fait, avant tout envoi.
    await expect(carte.getByText(/Prête :/)).toBeVisible({ timeout: 60_000 });

    await carte.getByRole("button", { name: "Enregistrer" }).click();
    await expect(carte.getByText("Section enregistrée.")).toBeVisible({ timeout: 60_000 });

    const enBase = await prisma.pageSection.findFirstOrThrow({
      where: { page: "accueil", type: "appel" },
      orderBy: { sortOrder: "desc" },
    });
    const chemin = String((enBase.settings as Record<string, unknown>).image ?? "");
    expect(chemin, "l'illustration doit avoir été enregistrée").not.toBe("");

    /*
     * L'URL servie porte l'empreinte du fichier. Sans elle, remplacer une
     * illustration laissait l'ancienne affichée dix minutes : l'adresse ne
     * dépendait que de l'identifiant de la section, et le cache la gardait.
     */
    const source = await carte.locator('img[src*="/image"]').getAttribute("src");
    expect(source).toContain("?v=");
  } finally {
    if (sectionId) {
      /*
       * Le fichier d'abord, puis la ligne. Supprimer la ligne seule laissait
       * l'illustration de plusieurs mégaoctets sur le disque à chaque exécution,
       * sans plus rien pour y mener (§17).
       */
      const section = await prisma.pageSection.findUnique({ where: { id: sectionId } });
      const image = (section?.settings as Record<string, unknown> | null)?.image;
      if (typeof image === "string" && image) {
        await fileStorage.delete(image).catch(() => undefined);
      }
      await prisma.pageSection.deleteMany({ where: { id: sectionId } });
    }
  }
});
