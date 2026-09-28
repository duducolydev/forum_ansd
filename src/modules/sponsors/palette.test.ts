import { describe, expect, it } from "vitest";
import { cleDuNiveau, tonDuNiveau, TONS } from "./palette";

describe("couleur d'un niveau de partenariat", () => {
  it.each([
    ["PRINCIPAL", "Sponsor principal", "principal"],
    ["GOLD", "Gold", "or"],
    ["SILVER", "Silver", "argent"],
    ["BRONZE", "Bronze", "bronze"],
    ["INSTITUTIONNEL", "Partenaire institutionnel", "institutionnel"],
    ["TECHNIQUE", "Partenaire technique", "technique"],
    ["MEDIA", "Partenaire média", "media"],
  ] as const)("donne au niveau %s du seed sa couleur", (code, name, attendu) => {
    expect(cleDuNiveau({ code, name })).toBe(attendu);
  });

  it("reconnaît un niveau créé en BackOffice d'après son libellé", () => {
    expect(cleDuNiveau({ code: "NIV_8", name: "Partenaire médias" })).toBe("media");
    expect(cleDuNiveau({ code: "NIV_9", name: "Sponsor Or" })).toBe("or");
    expect(cleDuNiveau({ code: "NIV_10", name: "Partenaire Argent" })).toBe("argent");
  });

  it("ne lit pas « or » à l'intérieur d'un mot", () => {
    // « SPONSOR » contient « OR » : seul un mot entier doit compter.
    expect(cleDuNiveau({ code: "SPONSOR_ASSOCIE", name: "Sponsor associé" })).toBe(
      "institutionnel",
    );
  });

  it("donne le vert du site à un niveau inconnu", () => {
    expect(tonDuNiveau({ code: "AMI", name: "Ami du Forum" })).toBe(TONS.institutionnel);
  });

  it("distingue Gold, Silver, Média et Technique", () => {
    const pastilles = ["or", "argent", "media", "technique"].map(
      (cle) => TONS[cle as keyof typeof TONS].pastille,
    );
    expect(new Set(pastilles).size).toBe(4);
  });
});
