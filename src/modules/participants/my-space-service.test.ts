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
  it("n'expose ni la catégorie ni le statut ni les consentements", () => {
    const parsed = mySpaceInputSchema.parse({
      firstName: "  Awa  ",
      lastName: "Diagne",
      categoryId: "cat_autre",
      status: "CONFIRMED",
      consentImage: true,
    } as Record<string, unknown>);

    expect(parsed.firstName).toBe("Awa");
    expect(parsed).not.toHaveProperty("categoryId");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("consentImage");
  });

  it("exige un prénom et un nom", () => {
    expect(mySpaceInputSchema.safeParse({ firstName: "", lastName: "Diagne" }).success).toBe(false);
  });
});
