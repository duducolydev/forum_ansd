import { beforeEach, describe, expect, it, vi } from "vitest";

const envois = vi.hoisted(() => [] as unknown[]);
vi.mock("@/modules/notifications/jobs", () => ({
  enqueueNotification: vi.fn(async (payload: unknown) => {
    envois.push(payload);
  }),
}));

import { envoyerMessageContact, messageContactSchema } from "./service";

const message = {
  nom: "Awa Ndiaye",
  email: "awa@example.org",
  organisation: "",
  objet: "Question sur l'hébergement",
  message: "Bonjour, les hôtels partenaires proposent-ils une navette ?",
};

describe("formulaire de contact : validation", () => {
  it("ramène l'objet sur une ligne (pas d'en-tête injecté)", () => {
    const analyse = messageContactSchema.parse({ ...message, objet: "Bonjour\r\nBcc: x@y.z" });
    expect(analyse.objet).toBe("Bonjour Bcc: x@y.z");
  });

  it("refuse une adresse invalide et un message trop court", () => {
    expect(messageContactSchema.safeParse({ ...message, email: "pas-une-adresse" }).success).toBe(
      false,
    );
    expect(messageContactSchema.safeParse({ ...message, message: "Salut" }).success).toBe(false);
  });
});

describe("formulaire de contact : envoi", () => {
  beforeEach(() => {
    envois.length = 0;
  });

  it("met en file un message vers la boîte du Forum, réponse au visiteur", async () => {
    const email = `contact-${crypto.randomUUID()}@example.org`;
    const resultat = await envoyerMessageContact(
      { ...message, email },
      `test-${crypto.randomUUID()}`,
    );
    expect(resultat.status).toBe("ENVOYE");
    expect(envois).toHaveLength(1);
    expect(envois[0]).toMatchObject({
      templateKey: "contact_message",
      to: "forumansd@gmail.com",
      replyTo: email,
      variables: { nom: "Awa Ndiaye", organisation: "—" },
    });
  });

  it("limite les envois répétés d'une même adresse", async () => {
    const email = `contact-${crypto.randomUUID()}@example.org`;
    const statuts = [];
    for (let i = 0; i < 4; i++) {
      const resultat = await envoyerMessageContact(
        { ...message, email },
        `test-${crypto.randomUUID()}`,
      );
      statuts.push(resultat.status);
    }
    expect(statuts).toEqual(["ENVOYE", "ENVOYE", "ENVOYE", "LIMITE"]);
    expect(envois).toHaveLength(3);
  });
});
