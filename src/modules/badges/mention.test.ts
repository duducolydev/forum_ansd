import { describe, expect, it } from "vitest";
import { mentionDuBadge } from "./mention";
import { renderBadgeHtml, type BadgeTemplateData } from "./template";

const base: BadgeTemplateData = {
  editionName: "Forum international sur les données",
  firstName: "Awa",
  lastName: "Ndiaye",
  jobTitle: "Journaliste",
  organization: "RTS",
  country: "Sénégal",
  categoryLabel: "Média",
  categoryColor: "#C8323A",
  publicId: "FID26-TEST01",
  qrDataUrl: "data:image/png;base64,AAAA",
  photoDataUrl: null,
};

describe("mention d'accréditation sur le badge", () => {
  it("imprime la mention d'un journaliste accrédité", () => {
    expect(renderBadgeHtml({ ...base, mention: "ACCRÉDITATION PRESSE" })).toContain(
      '<div class="mention">ACCRÉDITATION PRESSE</div>',
    );
  });

  it("n'imprime rien pour les autres badges", () => {
    expect(renderBadgeHtml(base)).not.toContain('class="mention"');
  });
});

describe("mention de catégorie sur le badge (24 octobre 2026)", () => {
  const comite = { requiresAccreditation: false, badgeMention: "COMITÉ D'ORGANISATION" };
  const presse = { requiresAccreditation: true, badgeMention: null };

  it("imprime la mention d'une catégorie en bande pleine, à sa couleur", () => {
    const html = renderBadgeHtml({
      ...base,
      categoryLabel: "Comité d'organisation",
      categoryColor: "#6D4C9F",
      ...mentionDuBadge(comite, null),
    });
    expect(html).toContain(`<div class="mention couleur">COMITÉ D'ORGANISATION</div>`);
    // Texte blanc sur le violet : l'encre la plus lisible des deux.
    expect(html).toMatch(/\.mention\.couleur \{\s*background: #6D4C9F; color: #ffffff;/);
  });

  it("prend l'encre sombre sur une couleur claire", () => {
    const html = renderBadgeHtml({
      ...base,
      categoryColor: "#E9E9A0",
      ...mentionDuBadge(comite, null),
    });
    expect(html).toMatch(/\.mention\.couleur \{\s*background: #E9E9A0; color: #12212f;/);
  });

  it("garde à la presse sa bande d'origine, et seulement une fois accréditée", () => {
    expect(mentionDuBadge(presse, null)).toEqual({ mention: null, mentionEnCouleur: false });
    expect(mentionDuBadge(presse, new Date())).toEqual({
      mention: "ACCRÉDITATION PRESSE",
      mentionEnCouleur: false,
    });
  });

  it("n'imprime rien pour une catégorie sans mention", () => {
    expect(mentionDuBadge({ requiresAccreditation: false, badgeMention: " " }, null)).toEqual({
      mention: null,
      mentionEnCouleur: false,
    });
  });
});
