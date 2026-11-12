import { describe, expect, it } from "vitest";
import { renderBadgeHtml, type BadgeTemplateData } from "./template";

const base: BadgeTemplateData = {
  editionName: "Forum international sur les données",
  firstName: "Awa",
  lastName: "Ndiaye",
  jobTitle: "Journaliste",
  organization: "RTS",
  categoryColor: "#C8323A",
  publicId: "FID26-TEST01",
  qrDataUrl: "data:image/png;base64,AAAA",
  photoDataUrl: null,
};

/** Contenu du bandeau coloré du bas. */
function bandeau(html: string): string {
  return html.match(/<div class="bandeau">(.*?)<\/div>/)?.[1] ?? "(introuvable)";
}

describe("bandeau du badge (12 novembre 2026 : la couleur seule)", () => {
  it("ne porte plus aucun texte", () => {
    const html = renderBadgeHtml(base);
    expect(bandeau(html)).toBe("");
    // Les classes du libellé sur deux lignes ont disparu avec lui : un style
    // resté en place finirait par être réalimenté sans qu'on le veuille.
    expect(html).not.toContain(".bandeau .fort");
    expect(html).not.toContain(".bandeau .leger");
  });

  it("garde la place et la couleur de la catégorie, en aplat", () => {
    const html = renderBadgeHtml({ ...base, categoryColor: "#6D4C9F" });
    expect(html).toMatch(/\.bandeau \{[^}]*top: 119\.6mm; height: 17\.6mm;/);
    expect(html).toMatch(/\.bandeau \{[^}]*color-mix\(in srgb, #6D4C9F 88%, #fff\)\)/);
  });

  it("prend la couleur par défaut quand la catégorie n'en a pas", () => {
    const html = renderBadgeHtml({ ...base, categoryColor: null });
    expect(html).toMatch(/\.bandeau \{[^}]*color-mix\(in srgb, #3dbb6e 88%, #fff\)\)/);
  });

  it("n'imprime le nom d'aucune catégorie, mention comprise", () => {
    // Le gabarit ne reçoit plus ni libellé ni mention : rien, dans le HTML
    // produit, ne peut porter « Média » ou « ACCRÉDITATION PRESSE ».
    const html = renderBadgeHtml(base);
    expect(html).not.toContain("Média");
    expect(html).not.toContain("ACCRÉDITATION");
  });
});

describe("initiales sans photo", () => {
  it("les pose sur la couleur de la catégorie, dans le cadre de la photo", () => {
    const html = renderBadgeHtml({ ...base, categoryColor: "#6D4C9F" });
    expect(html).toContain('<div class="photo initiales">AN</div>');
    expect(html).toMatch(/\.photo\.initiales \{[^}]*background: #6D4C9F;/);
  });

  it("choisit l'encre qui se lit sur la couleur de la catégorie", () => {
    // Texte blanc sur le violet…
    expect(renderBadgeHtml({ ...base, categoryColor: "#6D4C9F" })).toMatch(
      /\.photo\.initiales \{[^}]*color: #ffffff;/,
    );
    // … encre sombre sur une couleur claire.
    expect(renderBadgeHtml({ ...base, categoryColor: "#E9E9A0" })).toMatch(
      /\.photo\.initiales \{[^}]*color: #12212f;/,
    );
  });
});
