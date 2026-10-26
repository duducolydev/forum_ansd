import { describe, expect, it } from "vitest";
import { mentionDuBadge } from "./mention";
import { libelleEnDeuxLignes, renderBadgeHtml, type BadgeTemplateData } from "./template";

const base: BadgeTemplateData = {
  editionName: "Forum international sur les données",
  firstName: "Awa",
  lastName: "Ndiaye",
  jobTitle: "Journaliste",
  organization: "RTS",
  categoryLabel: "Média",
  categoryColor: "#C8323A",
  publicId: "FID26-TEST01",
  qrDataUrl: "data:image/png;base64,AAAA",
  photoDataUrl: null,
};

/** Contenu du bandeau coloré du bas. */
function bandeau(html: string): string {
  return html.match(/<div class="bandeau">(.*?)<\/div>/)?.[1] ?? "";
}

describe("bandeau du badge (maquette du 26 octobre 2026)", () => {
  it("porte le libellé de la catégorie, la dernière ligne en gras", () => {
    expect(bandeau(renderBadgeHtml({ ...base, categoryLabel: "Personnel ANSD" }))).toBe(
      '<span class="leger">Personnel</span><span class="fort">ANSD</span>',
    );
  });

  it("porte la mention à la place du libellé, quand la catégorie en a une", () => {
    const html = renderBadgeHtml({ ...base, mention: "ACCRÉDITATION PRESSE" });
    expect(bandeau(html)).toBe(
      '<span class="leger">ACCRÉDITATION</span><span class="fort">PRESSE</span>',
    );
    expect(html).not.toContain(">Média<");
  });

  it("prend la couleur de la catégorie, et l'encre qui s'y lit le mieux", () => {
    // Texte blanc sur le violet…
    expect(renderBadgeHtml({ ...base, categoryColor: "#6D4C9F" })).toMatch(
      /color-mix\(in srgb, #6D4C9F 88%, #fff\)\);\s*color: #ffffff;/,
    );
    // … encre sombre sur une couleur claire.
    expect(renderBadgeHtml({ ...base, categoryColor: "#E9E9A0" })).toMatch(
      /color-mix\(in srgb, #E9E9A0 88%, #fff\)\);\s*color: #12212f;/,
    );
  });
});

describe("libellé du bandeau sur deux lignes", () => {
  it("coupe là où les deux lignes s'équilibrent le mieux", () => {
    // 10 et 20 caractères, plutôt que 21 et 9.
    expect(libelleEnDeuxLignes("Délégation officielle étrangère")).toEqual([
      "Délégation",
      "officielle étrangère",
    ]);
    expect(libelleEnDeuxLignes("Comité d'organisation")).toEqual(["Comité", "d'organisation"]);
  });

  it("laisse un mot seul sur une ligne", () => {
    expect(libelleEnDeuxLignes("  Presse ")).toEqual(["Presse"]);
  });
});

describe("initiales sans photo", () => {
  it("les pose sur la couleur de la catégorie, dans le cadre de la photo", () => {
    const html = renderBadgeHtml({ ...base, categoryColor: "#6D4C9F" });
    expect(html).toContain('<div class="photo initiales">AN</div>');
    expect(html).toMatch(/\.photo\.initiales \{[^}]*background: #6D4C9F;/);
  });
});

describe("mention de catégorie (24 octobre 2026)", () => {
  const comite = { requiresAccreditation: false, badgeMention: "COMITÉ D'ORGANISATION" };
  const presse = { requiresAccreditation: true, badgeMention: null };

  it("imprime toujours la mention d'une catégorie qui en a une", () => {
    expect(mentionDuBadge(comite, null)).toEqual({ mention: "COMITÉ D'ORGANISATION" });
  });

  it("n'imprime la mention de la presse qu'une fois l'accréditation accordée", () => {
    expect(mentionDuBadge(presse, null)).toEqual({ mention: null });
    expect(mentionDuBadge(presse, new Date())).toEqual({ mention: "ACCRÉDITATION PRESSE" });
  });

  it("n'imprime rien pour une catégorie sans mention", () => {
    expect(mentionDuBadge({ requiresAccreditation: false, badgeMention: " " }, null)).toEqual({
      mention: null,
    });
  });
});
