import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getListePresence, getPresenceDuJour, listerJours } from "./service";
import { listePresenceHtml } from "./pdf";

const JOUR = new Date("2026-11-23T00:00:00.000Z");
const SUFFIXE = randomUUID().slice(0, 8).toUpperCase();

const emails: string[] = [];
let editionId = "";
let categoryId = "";
let zoneId = "";
let checkpointId = "";
let autreCheckpointId = "";
const participants: { id: string; publicId: string }[] = [];

async function creerParticipant(prenom: string, nom: string, pays = "Sénégal") {
  const email = `presence-${randomUUID()}@example.test`;
  emails.push(email);
  const participant = await prisma.participant.create({
    data: {
      editionId,
      publicId: `PRES-${SUFFIXE}-${participants.length}`,
      firstName: prenom,
      lastName: nom,
      email,
      country: pays,
      organization: "ANSD",
      categoryId,
      status: "CONFIRMED",
      source: "ONSITE",
      confirmedAt: new Date(),
    },
  });
  participants.push({ id: participant.id, publicId: participant.publicId });
  return participant;
}

async function scanner(
  participantId: string | null,
  options: { resultat?: string; heure?: string; point?: string } = {},
) {
  await prisma.scanLog.create({
    data: {
      clientScanId: randomUUID(),
      checkpointId: options.point ?? checkpointId,
      participantId,
      badgeVersion: 1,
      scannedAt: new Date(`2026-11-23T${options.heure ?? "09:00"}:00.000Z`),
      day: JOUR,
      direction: "IN",
      result: (options.resultat ?? "OK") as "OK",
    },
  });
}

describe("présences (brief §5.6)", () => {
  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;

    // Catégorie dédiée : les taux portent sur toute la population de l'édition,
    // et une catégorie partagée avec le jeu de démonstration rendrait les
    // attentes dépendantes de données que ce test ne maîtrise pas.
    const categorie = await prisma.participantCategory.create({
      data: {
        editionId,
        code: `CPRES_${SUFFIXE}`,
        labelFr: `Catégorie test ${SUFFIXE}`,
        labelEn: `Test category ${SUFFIXE}`,
        sortOrder: 999,
      },
    });
    categoryId = categorie.id;

    const zone = await prisma.zone.create({
      data: { editionId, code: `ZPRES${SUFFIXE}`, name: `Zone présence ${SUFFIXE}` },
    });
    zoneId = zone.id;

    checkpointId = (
      await prisma.checkpoint.create({
        data: { editionId, zoneId, name: `Poste A ${SUFFIXE}` },
      })
    ).id;
    autreCheckpointId = (
      await prisma.checkpoint.create({
        data: { editionId, zoneId, name: `Poste B ${SUFFIXE}` },
      })
    ).id;

    const [a, b] = [
      await creerParticipant("Aminata", "Sow"),
      await creerParticipant("Oumar", "Ba"),
    ];
    await creerParticipant("Kwame", "Osei", "Ghana"); // jamais scanné

    // Deux passages du même participant : il ne doit compter qu'une fois.
    await scanner(a.id, { heure: "08:15" });
    await scanner(a.id, { heure: "10:30", point: autreCheckpointId });
    await scanner(b.id, { heure: "09:45" });
    // Un refus et un badge inconnu, qui ne sont pas des présences.
    await scanner(b.id, { resultat: "DENIED_ZONE", heure: "11:00" });
    await scanner(null, { resultat: "UNKNOWN", heure: "11:05" });
  });

  afterAll(async () => {
    await prisma.scanLog.deleteMany({
      where: { checkpointId: { in: [checkpointId, autreCheckpointId] } },
    });
    await prisma.checkpoint.deleteMany({
      where: { id: { in: [checkpointId, autreCheckpointId] } },
    });
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.zone.deleteMany({ where: { id: zoneId } });
    await prisma.participantCategory.deleteMany({ where: { id: categoryId } });
    await prisma.$disconnect();
  }, 30_000);

  it("compte des personnes, pas des scans", async () => {
    const presence = await getPresenceDuJour(editionId, JOUR);
    const ligne = presence.parCategorie.find((c) => c.libelle === `Catégorie test ${SUFFIXE}`);

    // Trois participants attendus, deux venus, dont un passé deux fois.
    expect(ligne).toMatchObject({ presents: 2, attendus: 3 });
    expect(ligne!.taux).toBeCloseTo(66.7, 1);
  });

  it("exclut refus et badges inconnus des présences, mais les compte comme scans", async () => {
    const presence = await getPresenceDuJour(editionId, JOUR);
    const poste = presence.parPoint.find((p) => p.checkpointId === checkpointId);

    expect(poste).toBeDefined();
    expect(poste!.autorises).toBe(2);
    expect(poste!.refuses).toBe(2);
    expect(presence.kpis.refus).toBeGreaterThanOrEqual(2);
  });

  it("ne compte qu'une fois dans l'affluence un participant passé à deux postes de la zone", async () => {
    const presence = await getPresenceDuJour(editionId, JOUR);
    const zone = presence.parZone.find((z) => z.zone === `Zone présence ${SUFFIXE}`);
    expect(zone?.affluence).toBe(2);
  });

  /**
   * L'invariant qui a déjà rattrapé un défaut à l'entonnoir du tableau de bord :
   * deux populations comptées séparément finissent par diverger.
   */
  it("ne produit jamais plus de présents que d'attendus", async () => {
    const presence = await getPresenceDuJour(editionId, JOUR);
    for (const ligne of [...presence.parCategorie, ...presence.parPays]) {
      expect(ligne.presents).toBeLessThanOrEqual(ligne.attendus);
      expect(ligne.taux).toBeLessThanOrEqual(100);
    }
    expect(presence.kpis.presents).toBeLessThanOrEqual(presence.kpis.attendus);
  });

  it("liste les absents avec les présents, et retient le premier passage", async () => {
    const liste = await getListePresence(editionId, { jour: JOUR, categoryId });

    expect(liste).toHaveLength(3);
    const absent = liste.find((ligne) => ligne.nom.startsWith("OSEI"));
    expect(absent?.premierPassage).toBeNull();

    const sow = liste.find((ligne) => ligne.nom.startsWith("SOW"));
    // 08:15 et non 10:30 : c'est l'arrivée qui compte.
    expect(sow?.premierPassage?.toISOString()).toBe("2026-11-23T08:15:00.000Z");
  });

  it("retient le jour dans la liste des journées scannées", async () => {
    const jours = await listerJours(editionId);
    expect(jours.map((jour) => jour.toISOString().slice(0, 10))).toContain("2026-11-23");
  });

  describe("gabarit PDF", () => {
    it("laisse la colonne signature vide et masque les heures sur l'émargement", async () => {
      const lignes = await getListePresence(editionId, { jour: JOUR, categoryId });
      const html = listePresenceHtml({
        editionName: "Forum test",
        titre: "Feuille d'émargement",
        sousTitre: "Toutes catégories",
        jour: JOUR,
        forme: "EMARGEMENT",
        lignes,
      });

      expect(html).toContain("Signature");
      expect(html).toContain('class="signature"');
      // Aucune heure : la feuille se prépare avant la séance.
      expect(html).not.toContain("08:15");
      // Sur le contenu des lignes, pas sur le mot : la feuille de style porte
      // les classes `.absent` en permanence.
      expect(html).not.toContain('<span class="absent">');
    });

    it("marque les absents et affiche les heures sur le constat", async () => {
      const lignes = await getListePresence(editionId, { jour: JOUR, categoryId });
      const html = listePresenceHtml({
        editionName: "Forum test",
        titre: "Liste de présence",
        sousTitre: "Toutes catégories",
        jour: JOUR,
        forme: "CONSTAT",
        lignes,
      });

      expect(html).toContain("08:15");
      expect(html).toContain('<span class="absent">absent</span>');
      expect(html).not.toContain('class="signature"');
      expect(html).toContain("3 personne(s) attendue(s) · 2 présente(s)");
    });

    it("échappe le HTML des champs libres", async () => {
      const html = listePresenceHtml({
        editionName: "Forum",
        titre: "Liste",
        sousTitre: "x",
        jour: JOUR,
        forme: "CONSTAT",
        lignes: [
          {
            publicId: "X",
            nom: "<script>alert(1)</script>",
            organisation: null,
            categorie: "c",
            pays: "p",
            premierPassage: null,
          },
        ],
      });
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });
});
