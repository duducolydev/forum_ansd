import { describe, expect, it } from "vitest";
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
