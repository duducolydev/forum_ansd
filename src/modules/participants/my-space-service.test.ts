import { describe, expect, it } from "vitest";
import { canEditNow, editDeadline, mySpaceInputSchema } from "./my-space-service";

const START = new Date("2026-11-23T08:00:00.000Z");

describe("fenêtre de modification J-3 (brief §5.3)", () => {
  it("place l'échéance trois jours avant l'ouverture", () => {
    expect(editDeadline(START).toISOString()).toBe("2026-11-20T08:00:00.000Z");
  });

  it("autorise la modification avant J-3 et la refuse ensuite", () => {
    expect(canEditNow(START, new Date("2026-11-20T07:59:00.000Z"))).toBe(true);
    expect(canEditNow(START, new Date("2026-11-20T08:00:00.000Z"))).toBe(false);
    expect(canEditNow(START, new Date("2026-11-23T09:00:00.000Z"))).toBe(false);
  });
});

describe("mySpaceInputSchema", () => {
  /** Le minimum qu'exige l'inscription : nom, pays, une journée. */
  const MINIMUM = {
    firstName: "Awa",
    lastName: "Diagne",
    country: "Sénégal",
    participationDays: ["2026-11-23"],
  };

  it("n'expose ni la catégorie ni le statut ni les consentements", () => {
    const parsed = mySpaceInputSchema.parse({
      ...MINIMUM,
      firstName: "  Awa  ",
      categoryId: "cat_autre",
      status: "CONFIRMED",
      consentImage: true,
      email: "autre@example.test",
    } as Record<string, unknown>);

    expect(parsed.firstName).toBe("Awa");
    expect(parsed).not.toHaveProperty("categoryId");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("consentImage");
    expect(parsed).not.toHaveProperty("email");
  });

  it("exige un prénom et un nom", () => {
    expect(mySpaceInputSchema.safeParse({ ...MINIMUM, firstName: "" }).success).toBe(false);
  });

  it("accepte tout ce que l'inscription a saisi", () => {
    const parsed = mySpaceInputSchema.parse({
      ...MINIMUM,
      phone: "+221 77 123 45 67",
      organizationType: "Institut national de statistique",
      activityDomain: "Statistiques démographiques",
      website: "https://www.ansd.sn",
      bio: "Statisticienne, spécialiste des recensements.",
      participationDays: ["2026-11-23", "2026-11-24"],
      attendsOpening: true,
      arrivalDate: "2026-11-22",
      departureDate: "2026-11-26",
      needsAccommodation: true,
    });

    expect(parsed).toMatchObject({
      bio: "Statisticienne, spécialiste des recensements.",
      participationDays: ["2026-11-23", "2026-11-24"],
      attendsOpening: true,
      attendsClosing: false,
      needsAccommodation: true,
      needsTransport: false,
    });
  });

  it("garde les règles de l'inscription : pays, une journée", () => {
    expect(mySpaceInputSchema.safeParse({ ...MINIMUM, country: " " }).success).toBe(false);
    expect(mySpaceInputSchema.safeParse({ ...MINIMUM, participationDays: [] }).success).toBe(false);
  });

  it("accepte la biographie longue de la fiche intervenant, dont c'est la même", () => {
    const mots = (n: number) => Array.from({ length: n }, () => "mot").join(" ");
    expect(mySpaceInputSchema.safeParse({ ...MINIMUM, bio: mots(600) }).success).toBe(true);
    expect(mySpaceInputSchema.safeParse({ ...MINIMUM, bio: mots(601) }).success).toBe(false);
  });

  it("refuse une date mal formée ou un départ avant l'arrivée", () => {
    expect(mySpaceInputSchema.safeParse({ ...MINIMUM, arrivalDate: "22/11/2026" }).success).toBe(
      false,
    );
    const inverse = mySpaceInputSchema.safeParse({
      ...MINIMUM,
      arrivalDate: "2026-11-25",
      departureDate: "2026-11-22",
    });
    expect(inverse.success).toBe(false);
    expect(inverse.error?.issues[0]?.message).toBe("La date de départ précède la date d'arrivée");
    expect(mySpaceInputSchema.safeParse({ ...MINIMUM, arrivalDate: "2026-11-22" }).success).toBe(
      true,
    );
  });
});
