import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createParticipant } from "@/modules/participants/service";
import {
  bulkWhere,
  interpolate,
  pickLocalised,
  previewBulk,
  renderHtml,
  undeclaredVariables,
} from "./service";

describe("interpolation des modèles", () => {
  it("remplace les variables connues", () => {
    expect(interpolate("Bonjour {{prenom}} {{nom}}", { prenom: "Awa", nom: "Diagne" })).toBe(
      "Bonjour Awa Diagne",
    );
  });

  it("laisse intactes les variables inconnues plutôt que d'écrire « undefined »", () => {
    expect(interpolate("Bonjour {{prenon}}", { prenom: "Awa" })).toBe("Bonjour {{prenon}}");
  });

  it("échappe le HTML du contenu injecté", () => {
    const html = renderHtml(interpolate("Bonjour {{prenom}}", { prenom: "<script>x</script>" }));
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("choix de la langue (le squelette initial envoyait toujours en français)", () => {
  const template = {
    subjectFr: "Votre badge est disponible",
    subjectEn: "Your badge is ready",
    bodyFr: "Bonjour {{prenom}}, votre badge est prêt.",
    bodyEn: "Hello {{prenom}}, your badge is ready.",
  };

  it("sert la version anglaise à un participant anglophone", () => {
    const picked = pickLocalised(template, "en");
    expect(picked.subject).toBe("Your badge is ready");
    expect(picked.body).toContain("your badge is ready");
  });

  it("sert la version française par défaut", () => {
    expect(pickLocalised(template, "fr").subject).toBe("Votre badge est disponible");
  });

  it("retombe sur le français si la version anglaise est vide", () => {
    const partial = { ...template, subjectEn: "", bodyEn: "   " };
    const picked = pickLocalised(partial, "en");
    expect(picked.subject).toBe("Votre badge est disponible");
    expect(picked.body).toBe(template.bodyFr);
  });
});

describe("variables non déclarées", () => {
  it("signale une variable utilisée mais absente de la déclaration", () => {
    expect(
      undeclaredVariables({
        bodyFr: "Bonjour {{prenom}}, code {{code6}}",
        bodyEn: "Hello {{prenon}}",
        subjectFr: "Objet {{lien_badge}}",
        subjectEn: null,
        declared: ["prenom", "code6"],
      }),
    ).toEqual(["lien_badge", "prenon"]);
  });

  it("ne signale rien quand tout est déclaré", () => {
    expect(
      undeclaredVariables({
        bodyFr: "Bonjour {{prenom}}",
        bodyEn: "Hello {{prenom}}",
        subjectFr: "",
        subjectEn: "",
        declared: ["prenom"],
      }),
    ).toEqual([]);
  });
});

describe("envoi groupé", () => {
  const emails: string[] = [];
  let editionId = "";
  let editionCode = "";
  let categoryId = "";

  beforeAll(async () => {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    editionId = edition.id;
    editionCode = edition.code;
    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "PARTICIPANT_NATIONAL" },
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it("construit un filtre qui exclut toujours les participants supprimés", () => {
    const where = bulkWhere("ed1", { status: "CONFIRMED", country: "Mali" });
    expect(where).toMatchObject({ editionId: "ed1", deletedAt: null, country: "Mali" });
    expect(where.categoryId).toBeUndefined();
  });

  it("compte la population et en renvoie un échantillon", async () => {
    const country = `Testland-${crypto.randomUUID().slice(0, 8)}`;
    for (const name of ["Un", "Deux", "Trois"]) {
      const email = `bulk-${crypto.randomUUID()}@example.test`;
      emails.push(email);
      await createParticipant({
        editionId,
        editionCode,
        source: "ONSITE",
        actor: { type: "SYSTEM" },
        input: {
          firstName: name,
          lastName: "Test",
          email,
          country,
          locale: "fr",
          categoryId,
          attendsOpening: false,
          attendsInaugural: false,
          attendsAwards: false,
          needsAccommodation: false,
          needsTransport: false,
        },
      });
    }

    const preview = await previewBulk(editionId, { country }, 2);
    expect(preview.total).toBe(3);
    expect(preview.sample).toHaveLength(2);
    expect(preview.sample[0]!.email).toContain("@example.test");
  });
});
