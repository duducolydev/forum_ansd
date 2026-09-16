import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { createInvitation } from "@/modules/invitations/service";
import { registerPublicParticipant } from "./registration-service";
import type { RegistrationInput } from "./registration-schema";

const participantEmails: string[] = [];
const invitationIds: string[] = [];

function baseInput(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
  const email = overrides.email ?? `register-${crypto.randomUUID()}@example.test`;
  participantEmails.push(email);
  return {
    civility: "",
    firstName: "Awa",
    lastName: "Diagne",
    email,
    phone: "",
    country: "Sénégal",
    city: "",
    locale: "fr",
    categoryId: "",
    organization: "",
    organizationType: "",
    jobTitle: "",
    activityDomain: "",
    bio: "",
    website: "",
    participationDays: ["2026-11-23"],
    attendsOpening: true,
    attendsInaugural: false,
    attendsAwards: false,
    arrivalDate: "",
    departureDate: "",
    needsAccommodation: false,
    needsTransport: false,
    dietaryRequirements: "",
    specialNeeds: "",
    consentTerms: true,
    consentData: true,
    consentImage: false,
    invitationToken: "",
    captchaToken: "",
    fax: "",
    ...overrides,
  };
}

describe("rateLimit", () => {
  it("allows up to the limit then blocks within the window", async () => {
    const key = `test-${crypto.randomUUID()}`;
    const results = [];
    for (let i = 0; i < 4; i++) {
      results.push(await rateLimit(key, 3, 60));
    }
    expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
    expect(results[3].allowed).toBe(false);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("registerPublicParticipant (brief §5.3)", () => {
  afterAll(async () => {
    await prisma.participant.deleteMany({ where: { email: { in: participantEmails } } });
    await prisma.invitation.deleteMany({ where: { id: { in: invitationIds } } });
    await prisma.$disconnect();
  });

  async function context(categoryCode: string) {
    const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
    const category = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId: edition.id, code: categoryCode },
    });
    return { editionId: edition.id, editionCode: edition.code, categoryId: category.id };
  }

  it("registers a participant as REGISTERED for a manually-validated category", async () => {
    const { editionId, editionCode, categoryId } = await context("AUTORITE_VIP");
    const result = await registerPublicParticipant({
      editionId,
      editionCode,
      ip: `ip-${crypto.randomUUID()}`,
      input: baseInput({ categoryId }),
    });

    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;
    expect(result.participantStatus).toBe("REGISTERED");

    const created = await prisma.participant.findUniqueOrThrow({
      where: { id: result.participantId },
    });
    expect(created.consentTerms).toBe(true);
    expect(created.consentData).toBe(true);
    expect(created.consentAt).not.toBeNull();
    expect(created.source).toBe("ONLINE");
  });

  it("auto-confirms for a category flagged autoConfirm", async () => {
    const { editionId, editionCode, categoryId } = await context("PARTICIPANT_NATIONAL");
    const result = await registerPublicParticipant({
      editionId,
      editionCode,
      ip: `ip-${crypto.randomUUID()}`,
      input: baseInput({ categoryId }),
    });
    expect(result.status).toBe("OK");
    if (result.status === "OK") expect(result.participantStatus).toBe("CONFIRMED");
  });

  it("rejects a request whose honeypot field is filled", async () => {
    const { editionId, editionCode, categoryId } = await context("AUTORITE_VIP");
    const result = await registerPublicParticipant({
      editionId,
      editionCode,
      ip: `ip-${crypto.randomUUID()}`,
      input: baseInput({ categoryId, fax: "http://spam.example" }),
    });
    expect(result.status).toBe("REJECTED");
  });

  it("reports a duplicate e-mail instead of creating a second participant", async () => {
    const { editionId, editionCode, categoryId } = await context("AUTORITE_VIP");
    const input = baseInput({ categoryId });

    const first = await registerPublicParticipant({
      editionId,
      editionCode,
      ip: `ip-${crypto.randomUUID()}`,
      input,
    });
    expect(first.status).toBe("OK");

    const second = await registerPublicParticipant({
      editionId,
      editionCode,
      ip: `ip-${crypto.randomUUID()}`,
      input,
    });
    expect(second.status).toBe("DUPLICATE_EMAIL");
  });

  it("blocks after 5 attempts from the same IP within a minute", async () => {
    const { editionId, editionCode, categoryId } = await context("AUTORITE_VIP");
    const ip = `ip-${crypto.randomUUID()}`;

    /*
     * Le quota est consommé par des appels directs à `rateLimit`, et non par
     * cinq inscriptions complètes.
     *
     * La version précédente en enchaînait cinq : sous la charge de la suite
     * entière, elles dépassaient les soixante secondes de la fenêtre, celle-ci
     * repartait à zéro, et la sixième passait — un échec qui n'apprenait rien
     * sur le produit et ne se reproduisait jamais isolément. Ce que le test
     * doit établir est que le chemin d'inscription **consulte le même seau**,
     * et c'est exactement ce qui est vérifié ici, en quelques millisecondes.
     */
    for (let essai = 0; essai < 5; essai++) {
      const consomme = await rateLimit(`registration:${ip}`, 5, 60);
      expect(consomme.allowed).toBe(true);
    }

    const blocked = await registerPublicParticipant({
      editionId,
      editionCode,
      ip,
      input: baseInput({ categoryId }),
    });
    expect(blocked.status).toBe("RATE_LIMITED");
  });

  it("uses the invitation's category and marks the invitation as registered", async () => {
    const { editionId, editionCode, categoryId } = await context("INS");
    const email = `invited-${crypto.randomUUID()}@example.test`;
    participantEmails.push(email);

    const invitation = await createInvitation(
      editionId,
      { email, firstName: "Invité", lastName: "Test", categoryId },
      { type: "SYSTEM" },
    );
    invitationIds.push(invitation.id);

    const otherCategory = await prisma.participantCategory.findFirstOrThrow({
      where: { editionId, code: "MEDIA" },
    });

    const result = await registerPublicParticipant({
      editionId,
      editionCode,
      ip: `ip-${crypto.randomUUID()}`,
      // La catégorie du formulaire est volontairement différente : celle de
      // l'invitation doit primer.
      input: baseInput({ email, categoryId: otherCategory.id, invitationToken: invitation.token }),
    });

    expect(result.status).toBe("OK");
    if (result.status !== "OK") return;

    const created = await prisma.participant.findUniqueOrThrow({
      where: { id: result.participantId },
    });
    expect(created.categoryId).toBe(categoryId);

    const updatedInvitation = await prisma.invitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(updatedInvitation.status).toBe("REGISTERED");
  });

  describe("guichet d'inscription (§8.1)", () => {
    /**
     * Ferme le guichet le temps d'une assertion, puis rétablit les réglages.
     *
     * La fermeture est vérifiée **dans le service**, et pas seulement à
     * l'affichage : masquer le formulaire n'empêche personne de reposter la
     * requête, et c'est précisément ce que ce test exerce.
     */
    async function guichetFerme<T>(travail: () => Promise<T>): Promise<T> {
      const edition = await prisma.edition.findFirstOrThrow({ where: { code: "FID-2026" } });
      const avant = edition.settings;
      try {
        await prisma.edition.update({
          where: { id: edition.id },
          data: {
            settings: {
              ...(avant as object),
              inscriptions: {
                active: false,
                ouvertureLe: "",
                fermetureLe: "",
                messageFermeFr: "Les inscriptions sont closes.",
                messageFermeEn: "Registration is closed.",
              },
            },
          },
        });
        return await travail();
      } finally {
        await prisma.edition.update({
          where: { id: edition.id },
          data: { settings: avant as object },
        });
      }
    }

    it("refuse une inscription publique quand le guichet est fermé", async () => {
      const { editionId, editionCode, categoryId } = await context("PARTICIPANT_NATIONAL");

      const result = await guichetFerme(() =>
        registerPublicParticipant({
          editionId,
          editionCode,
          ip: `ip-${crypto.randomUUID()}`,
          input: baseInput({ categoryId }),
        }),
      );

      expect(result.status).toBe("CLOSED");
      if (result.status !== "CLOSED") return;
      expect(result.message).toBe("Les inscriptions sont closes.");
    });

    it("renvoie le message dans la langue du visiteur", async () => {
      const { editionId, editionCode, categoryId } = await context("PARTICIPANT_NATIONAL");

      const result = await guichetFerme(() =>
        registerPublicParticipant({
          editionId,
          editionCode,
          ip: `ip-${crypto.randomUUID()}`,
          input: baseInput({ categoryId, locale: "en" }),
        }),
      );

      expect(result.status).toBe("CLOSED");
      if (result.status !== "CLOSED") return;
      expect(result.message).toBe("Registration is closed.");
    });

    it("laisse passer une invitation nominative malgré la fermeture", async () => {
      const { editionId, editionCode, categoryId } = await context("AUTORITE_VIP");
      const email = `register-${crypto.randomUUID()}@example.test`;
      participantEmails.push(email);

      const invitation = await createInvitation(
        editionId,
        { email, firstName: "Fatou", lastName: "Sow", categoryId },
        { type: "SYSTEM" },
      );
      invitationIds.push(invitation.id);

      // Le comité a émis cette invitation : c'est lui qui décide des dates, et
      // fermer le guichet public ne doit pas invalider ce qu'il a promis.
      const result = await guichetFerme(() =>
        registerPublicParticipant({
          editionId,
          editionCode,
          ip: `ip-${crypto.randomUUID()}`,
          input: baseInput({ email, categoryId, invitationToken: invitation.token }),
        }),
      );

      expect(result.status).toBe("OK");
    });
  });

  /*
   * La catégorie arrive du formulaire public, donc du visiteur. Elle était lue
   * par son seul identifiant (PLAN.md §18).
   */
  describe("catégorie envoyée par le formulaire", () => {
    const categoriesCreees: string[] = [];

    afterAll(async () => {
      await prisma.participant.deleteMany({ where: { categoryId: { in: categoriesCreees } } });
      await prisma.participantCategory.deleteMany({ where: { id: { in: categoriesCreees } } });
    });

    it("refuse une catégorie retirée du formulaire", async () => {
      const { editionId, editionCode } = await context("PARTICIPANT_NATIONAL");
      const retiree = await prisma.participantCategory.create({
        data: {
          editionId,
          code: `TEST-RETIREE-${crypto.randomUUID().slice(0, 8)}`,
          labelFr: "Catégorie retirée (test)",
          labelEn: "Withdrawn category (test)",
          autoConfirm: true,
          isActive: false,
        },
      });
      categoriesCreees.push(retiree.id);

      const result = await registerPublicParticipant({
        editionId,
        editionCode,
        ip: `ip-${crypto.randomUUID()}`,
        input: baseInput({ categoryId: retiree.id }),
      });

      expect(result.status).toBe("CATEGORY_INVALID");
    });

    it("refuse un identifiant de catégorie inconnu de l'édition", async () => {
      const { editionId, editionCode } = await context("PARTICIPANT_NATIONAL");

      const result = await registerPublicParticipant({
        editionId,
        editionCode,
        ip: `ip-${crypto.randomUUID()}`,
        input: baseInput({ categoryId: "categorie-d-une-autre-edition" }),
      });

      expect(result.status).toBe("CATEGORY_INVALID");
    });
  });
});
