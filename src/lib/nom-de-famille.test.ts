import { describe, expect, it } from "vitest";
import { nomDeFamille } from "./nom-de-famille";
import { participantInputSchema } from "@/modules/participants/schema";
import { registrationIdentitySchema } from "@/modules/participants/registration-schema";
import { mySpaceInputSchema } from "@/modules/participants/my-space-service";
import { invitationImportRowSchema, invitationInputSchema } from "@/modules/invitations/schema";
import { speakerInputSchema } from "@/modules/speakers/service";

describe("nom de famille en capitales", () => {
  it("met en majuscules en gardant les accents", () => {
    expect(nomDeFamille("Diop")).toBe("DIOP");
    expect(nomDeFamille("Diène")).toBe("DIÈNE");
    expect(nomDeFamille("de la Fontaine-Ndiaye")).toBe("DE LA FONTAINE-NDIAYE");
  });

  it("s'applique à chaque saisie qui enregistre un nom", () => {
    const nom = { firstName: "Awa", lastName: "  Ndiaye " };
    const lus = [
      participantInputSchema.safeParse({
        ...nom,
        email: "a@x.test",
        country: "Sénégal",
        categoryId: "c",
      }),
      registrationIdentitySchema.safeParse({
        ...nom,
        email: "a@x.test",
        country: "Sénégal",
        categoryId: "c",
      }),
      mySpaceInputSchema.safeParse(nom),
      invitationInputSchema.safeParse({ ...nom, email: "a@x.test", categoryId: "c" }),
      invitationImportRowSchema.safeParse({ ...nom, email: "a@x.test", categoryCode: "C" }),
      speakerInputSchema.safeParse(nom),
    ];
    for (const lu of lus) {
      expect(lu.success).toBe(true);
      expect(lu.data?.lastName).toBe("NDIAYE");
      // Le prénom n'est pas touché.
      expect(lu.data?.firstName).toBe("Awa");
    }
  });
});
