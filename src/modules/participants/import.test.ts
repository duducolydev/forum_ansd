import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

const envois = vi.hoisted(() => [] as { templateKey: string; to: string }[]);
vi.mock("@/modules/notifications/jobs", async (original) => ({
  ...(await original<typeof import("@/modules/notifications/jobs")>()),
  enqueueNotification: vi.fn(async (payload: { templateKey: string; to: string }) => {
    envois.push(payload);
  }),
}));

import { prisma } from "@/lib/db";
import { analyserImport, importerParticipants, lireFichier, normaliserCle } from "./import";
import type { Actor } from "./service";

const acteur: Actor = { type: "SYSTEM" };
const suffixe = crypto.randomUUID().slice(0, 8);
const adresse = (nom: string) => `import-${nom}-${suffixe}@example.org`;

function classeur(lignes: Record<string, string>[]): Buffer {
  const livre = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livre, XLSX.utils.json_to_sheet(lignes), "Participants");
  return XLSX.write(livre, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

async function edition() {
  return prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
}

afterAll(async () => {
  await prisma.participant.deleteMany({ where: { email: { contains: `-${suffixe}@` } } });
  await prisma.$disconnect();
});

describe("import de participants : lecture", () => {
  it("reconnaît les en-têtes quels que soient accents, casse et espaces", () => {
    expect(normaliserCle("Catégorie de participation")).toBe("categorie_de_participation");

    const lignes = lireFichier(
      classeur([
        {
          Prénom: "Awa",
          NOM: "Ndiaye",
          "E-mail": "Awa@Example.org",
          Pays: "Sénégal",
          "Catégorie de participation": "Participant national",
          "Cérémonie de clôture": "Oui",
          "Colonne inconnue": "ignorée",
        },
      ]),
    );
    expect(lignes).toEqual([
      {
        rowNumber: 2,
        valeurs: {
          firstName: "Awa",
          lastName: "Ndiaye",
          email: "Awa@Example.org",
          country: "Sénégal",
          categorie: "Participant national",
          attendsClosing: "Oui",
        },
      },
    ]);
  });
});

describe("import de participants : vérification", () => {
  it("écarte les lignes fautives et dit pourquoi", async () => {
    const { id } = await edition();
    const base = {
      prenom: "Test",
      nom: "Import",
      pays: "Sénégal",
      categorie: "PARTICIPANT_NATIONAL",
    };
    const lignes = lireFichier(
      classeur([
        { ...base, email: adresse("ok") },
        { ...base, email: adresse("ok") }, // doublon dans le fichier
        { ...base, email: adresse("cat"), categorie: "Inconnue" },
        { ...base, email: "pas-une-adresse" },
        { ...base, email: adresse("bool"), ceremonie_cloture: "peut-être" },
        { ...base, email: adresse("presse"), categorie: "Média" },
        { ...base, email: adresse("pays"), pays: "" },
      ]),
    );

    const { valides, erreurs } = await analyserImport(id, lignes, { peutAccrediter: false });
    expect(valides.map((ligne) => ligne.input.email)).toEqual([adresse("ok")]);
    expect(erreurs.map((erreur) => erreur.rowNumber)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(erreurs[0]!.message).toContain("double");
    expect(erreurs[1]!.message).toContain("Catégorie inconnue");
    expect(erreurs[3]!.message).toContain("oui / non");
    expect(erreurs[4]!.message).toContain("accréditation");
  });

  it("accepte la presse pour qui peut accréditer", async () => {
    const { id } = await edition();
    const lignes = lireFichier(
      classeur([
        {
          prenom: "Presse",
          nom: "Import",
          email: adresse("media"),
          pays: "Sénégal",
          categorie: "MEDIA",
        },
      ]),
    );
    const { valides } = await analyserImport(id, lignes, { peutAccrediter: true });
    expect(valides[0]?.presse).toBe(true);
  });
});

describe("import de participants : inscription", () => {
  beforeEach(() => {
    envois.length = 0;
  });

  it("inscrit confirmé, prévient par e-mail et refuse un second import", async () => {
    const ed = await edition();
    const email = adresse("inscrit");
    const lignes = lireFichier(
      classeur([
        {
          prenom: "Moussa",
          nom: "Diop",
          email,
          pays: "Sénégal",
          categorie: "Autorités administratives", // validation manuelle d'ordinaire
          ceremonie_ouverture: "oui",
          langue: "en",
        },
      ]),
    );

    const { valides } = await analyserImport(ed.id, lignes, { peutAccrediter: false });
    const bilan = await importerParticipants(ed, valides, acteur, { peutAccrediter: false });
    expect(bilan).toEqual({ inscrits: 1, echecs: [] });

    const participant = await prisma.participant.findUniqueOrThrow({
      where: { editionId_email: { editionId: ed.id, email } },
    });
    expect(participant.status).toBe("CONFIRMED");
    expect(participant.source).toBe("IMPORT");
    expect(participant.attendsOpening).toBe(true);
    expect(participant.locale).toBe("en");
    expect(envois).toContainEqual(
      expect.objectContaining({ templateKey: "registration_imported", to: email }),
    );

    // Réimporter le même fichier : la personne est reconnue comme déjà inscrite.
    const second = await analyserImport(ed.id, lignes, { peutAccrediter: false });
    expect(second.valides).toHaveLength(0);
    expect(second.erreurs[0]!.message).toContain("Déjà inscrit");
  });

  it("accrédite la presse importée par l'administration", async () => {
    const ed = await edition();
    const email = adresse("journaliste");
    const lignes = lireFichier(
      classeur([{ prenom: "Fatou", nom: "Sow", email, pays: "Sénégal", categorie: "MEDIA" }]),
    );
    const { valides } = await analyserImport(ed.id, lignes, { peutAccrediter: true });
    await importerParticipants(ed, valides, acteur, { peutAccrediter: true });

    const participant = await prisma.participant.findUniqueOrThrow({
      where: { editionId_email: { editionId: ed.id, email } },
    });
    expect(participant.status).toBe("CONFIRMED");
    expect(participant.accreditedAt).not.toBeNull();
    expect(envois).toContainEqual(
      expect.objectContaining({ templateKey: "accreditation_granted", to: email }),
    );
  });
});
