import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { analyserImport, importerIntervenants, lireFichier, modeleImport } from "./import";
import type { Actor } from "./service";

const acteur: Actor = { type: "SYSTEM" };
const suffixe = crypto.randomUUID().slice(0, 8);
const adresse = (nom: string) => `import-${nom}-${suffixe}@example.org`;
// Numéros hors de portée d'un vrai programme, propres à ce fichier.
const NUMERO = 900_000 + Math.floor(Math.random() * 90_000);

function classeur(lignes: Record<string, string>[]): Buffer {
  const livre = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livre, XLSX.utils.json_to_sheet(lignes), "Intervenants");
  return XLSX.write(livre, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

let editionId: string;
const seances: Record<string, string> = {};

async function creerSeance(cle: string, titre: string, numero: number | null) {
  const seance = await prisma.session.create({
    data: {
      editionId,
      slug: `import-${cle}-${suffixe}`,
      number: numero,
      type: "PANEL",
      titleFr: titre,
      titleEn: titre,
      day: new Date("2026-11-24"),
      startTime: new Date("2026-11-24T09:00:00Z"),
      endTime: new Date("2026-11-24T10:00:00Z"),
    },
  });
  seances[cle] = seance.id;
}

beforeAll(async () => {
  editionId = (await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } })).id;
  await creerSeance("panel", `Panel import ${suffixe}`, NUMERO);
  await creerSeance("pause1", `Pause import ${suffixe}`, null);
  await creerSeance("pause2", `Pause import ${suffixe}`, null);
  await prisma.speaker.create({
    data: {
      editionId,
      firstName: "Existant",
      lastName: `Avec${suffixe}`,
      email: adresse("existant"),
    },
  });
  await prisma.speaker.create({
    data: { editionId, firstName: "Existant", lastName: `Sans${suffixe}` },
  });
});

afterAll(async () => {
  await prisma.speaker.deleteMany({ where: { lastName: { contains: suffixe } } });
  await prisma.speaker.deleteMany({ where: { email: { contains: `-${suffixe}@` } } });
  await prisma.session.deleteMany({ where: { slug: { endsWith: `-${suffixe}` } } });
  await prisma.$disconnect();
});

describe("import d'intervenants : lecture", () => {
  it("reconnaît les en-têtes quels que soient accents, casse et synonymes", () => {
    const lignes = lireFichier(
      classeur([
        {
          Prénom: "Awa",
          NOM: "Ndiaye",
          "E-mail": "Awa@Example.org",
          Fonction: "Directrice",
          "Biographie FR": "Statisticienne.",
          Publié: "Oui",
          Séances: "12; Panel 3",
          Rôle: "Modératrice",
          "Colonne inconnue": "ignorée",
        },
        { Prénom: "", NOM: "" },
      ]),
    );
    expect(lignes).toEqual([
      {
        rowNumber: 2,
        valeurs: {
          firstName: "Awa",
          lastName: "Ndiaye",
          email: "Awa@Example.org",
          jobTitle: "Directrice",
          bioFr: "Statisticienne.",
          isPublished: "Oui",
          seances: "12; Panel 3",
          role: "Modératrice",
        },
      },
    ]);
  });

  it("relit son propre modèle : chaque colonne du modèle est reconnue", async () => {
    const lignes = lireFichier(await modeleImport(editionId));
    expect(lignes).toHaveLength(1);
    expect(Object.keys(lignes[0]!.valeurs).sort()).toEqual(
      [
        "bioEn",
        "bioFr",
        "bioPt",
        "country",
        "email",
        "featuredOrder",
        "firstName",
        "isFeatured",
        "isPublished",
        "jobTitle",
        "lastName",
        "organization",
        "role",
        "seances",
      ].sort(),
    );
  });

  it("liste le programme et les rôles dans le modèle", async () => {
    const livre = XLSX.read(await modeleImport(editionId), { type: "buffer" });
    expect(livre.SheetNames).toEqual(["Intervenants", "Séances", "Rôles", "Aide"]);
    const programme = XLSX.utils.sheet_to_json<Record<string, string | number>>(
      livre.Sheets["Séances"]!,
    );
    expect(programme).toContainEqual(
      expect.objectContaining({ numero: NUMERO, titre: `Panel import ${suffixe}` }),
    );
  });
});

describe("import d'intervenants : vérification", () => {
  async function analyser(lignes: Record<string, string>[]) {
    return analyserImport(editionId, lireFichier(classeur(lignes)));
  }

  it("retient une ligne complète, avec ses séances par numéro, titre ou adresse", async () => {
    const { valides, erreurs } = await analyser([
      {
        prenom: "Awa",
        nom: `Valide${suffixe}`,
        email: adresse("Valide").toUpperCase(),
        publie: "oui",
        mis_en_avant: "x",
        ordre_mise_en_avant: "3",
        seances: `${NUMERO}; import-pause1-${suffixe}`,
        role: "Modératrice",
      },
    ]);
    expect(erreurs).toEqual([]);
    expect(valides).toHaveLength(1);
    const [ligne] = valides;
    expect(ligne!.input).toMatchObject({
      email: adresse("valide"),
      isPublished: true,
      isFeatured: true,
      featuredOrder: 3,
    });
    expect(ligne!.seances.map((s) => s.id)).toEqual([seances.panel, seances.pause1]);
    expect(ligne!.role).toBe("MODERATOR");

    const parTitre = await analyser([
      { prenom: "Awa", nom: `Titre${suffixe}`, seances: `panel IMPORT ${suffixe}` },
    ]);
    expect(parTitre.valides[0]!.seances.map((s) => s.id)).toEqual([seances.panel]);
    expect(parTitre.valides[0]!.role).toBe("PANELIST");
  });

  it("écarte, ligne par ligne, ce qui ne peut pas être créé", async () => {
    const { valides, erreurs } = await analyser([
      { prenom: "", nom: "Seul" },
      { prenom: "Awa", nom: `Double${suffixe}`, email: adresse("double") },
      { prenom: "Awa", nom: `Double${suffixe}`, email: adresse("double") },
      { prenom: "Awa", nom: `Existant${suffixe}`, email: adresse("existant") },
      { prenom: "Existant", nom: `Sans${suffixe}`, email: adresse("sans") },
      { prenom: "Existant", nom: `Avec${suffixe}` },
      { prenom: "Awa", nom: `Seance${suffixe}`, seances: "Séance qui n'existe pas" },
      { prenom: "Awa", nom: `Ambigu${suffixe}`, seances: `Pause import ${suffixe}` },
      { prenom: "Awa", nom: `Role${suffixe}`, role: "Animateur" },
      { prenom: "Awa", nom: `Booleen${suffixe}`, publie: "peut-être" },
      { prenom: "Awa", nom: `Courriel${suffixe}`, email: "pas-une-adresse" },
    ]);

    expect(valides.map((ligne) => ligne.rowNumber)).toEqual([3]);
    const messages = Object.fromEntries(erreurs.map((e) => [e.rowNumber, e.message]));
    expect(messages[2]).toMatch(/prénom/i);
    expect(messages[4]).toMatch(/en double dans le fichier/);
    expect(messages[5]).toMatch(/Déjà enregistré/);
    expect(messages[6]).toMatch(/sans adresse : complétez sa fiche/);
    expect(messages[7]).toMatch(/s'appelle déjà/);
    expect(messages[8]).toMatch(/Séance inconnue/);
    expect(messages[9]).toMatch(/Plusieurs séances/);
    expect(messages[10]).toMatch(/Rôle « Animateur » non reconnu/);
    expect(messages[11]).toMatch(/non reconnue pour la publication/);
    expect(messages[12]).toMatch(/e-mail invalide/i);
  });
});

describe("import d'intervenants : écriture", () => {
  it("crée les fiches et les rattache, puis écarte un second import du même fichier", async () => {
    const lignes = lireFichier(
      classeur([
        {
          prenom: "Moussa",
          nom: `Cree${suffixe}`,
          email: adresse("cree"),
          seances: String(NUMERO),
          role: "Intervention principale",
        },
        { prenom: "Binta", nom: `SansAdresse${suffixe}` },
      ]),
    );

    const premier = await analyserImport(editionId, lignes);
    const bilan = await importerIntervenants(editionId, premier.valides, acteur);
    expect(bilan).toEqual({ crees: 2, rattachements: 1, echecs: [] });

    const cree = await prisma.speaker.findFirstOrThrow({
      where: { email: adresse("cree") },
      select: { isPublished: true, sessions: { select: { sessionId: true, role: true } } },
    });
    expect(cree.isPublished).toBe(false);
    expect(cree.sessions).toEqual([{ sessionId: seances.panel, role: "KEYNOTE" }]);

    // Le même fichier, rechargé : rien n'est créé deux fois, rien n'est modifié.
    const second = await analyserImport(editionId, lignes);
    expect(second.valides).toEqual([]);
    expect(second.erreurs.map((e) => e.rowNumber)).toEqual([2, 3]);
  });
});
