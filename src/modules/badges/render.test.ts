import { afterAll, describe, expect, it } from "vitest";
import { closeBrowser, renderHtmlToPdf, renderHtmlToPng, resolveBrowserPath } from "@/lib/pdf";
import { buildBadgeToken } from "./token";
import { renderBadgeHtml } from "./template";
import { generateQrDataUrl } from "@/lib/qr";

async function sampleHtml(index: number): Promise<string> {
  const publicId = `FID26-BENCH${String(index).padStart(2, "0")}`;
  return renderBadgeHtml({
    editionName: "Forum international sur les données",
    firstName: "Aminata",
    lastName: "Sow",
    jobTitle: "Directrice des statistiques démographiques",
    organization: "ANSD",
    country: "Sénégal",
    categoryLabel: "Participante nationale",
    categoryColor: "#3dbb6e",
    publicId,
    qrDataUrl: await generateQrDataUrl(`http://localhost:3000/v/${buildBadgeToken(publicId, 1)}`),
    photoDataUrl: null,
  });
}

describe.skipIf(!resolveBrowserPath())("rendu du badge (Puppeteer)", () => {
  afterAll(async () => {
    await closeBrowser();
  }, 30_000);

  it("produit un PDF au format CR80 et un PNG", async () => {
    const html = await sampleHtml(1);

    const pdf = await renderHtmlToPdf(html, { format: "CR80" });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);

    const png = await renderHtmlToPng(html, { width: 1200 });
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    // Largeur encodée dans le chunk IHDR (octets 16-19).
    expect(png.readUInt32BE(16)).toBe(1200);
  }, 60_000);
});
