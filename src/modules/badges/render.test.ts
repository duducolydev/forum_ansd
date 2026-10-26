import { afterAll, describe, expect, it } from "vitest";
import { closeBrowser, renderHtmlToPdf, renderHtmlToPng, resolveBrowserPath } from "@/lib/pdf";
import { buildBadgeToken } from "./token";
import { renderBadgeHtml } from "./template";
import { FORMAT_BADGE, auGabaritCourant } from "./format";
import { policesBadgeCss } from "./polices";
import { generateQrDataUrl } from "@/lib/qr";

async function sampleHtml(index: number): Promise<string> {
  const publicId = `FID26-BENCH${String(index).padStart(2, "0")}`;
  return renderBadgeHtml({
    editionName: "Forum international sur les données",
    policesCss: await policesBadgeCss(),
    firstName: "Aminata",
    lastName: "Sow",
    jobTitle: "Directrice des statistiques démographiques",
    organization: "ANSD",
    categoryLabel: "Participante nationale",
    categoryColor: "#3dbb6e",
    publicId,
    qrDataUrl: await generateQrDataUrl(`http://localhost:3000/v/${buildBadgeToken(publicId, 1)}`),
    photoDataUrl: null,
  });
}

/** Points PDF (1/72 de pouce) d'une longueur en millimètres. */
const enPoints = (mm: number) => (mm / 25.4) * 72;

describe("gabarit du badge", () => {
  it("reconnaît un fichier rendu avec la maquette en vigueur", () => {
    expect(auGabaritCourant("badges/FID26-AB12/v1-maquette-2026.png")).toBe(true);
    // Carte CR80, puis premier 100 × 150 mm du 25 octobre 2026.
    expect(auGabaritCourant("badges/FID26-AB12/v1.png")).toBe(false);
    expect(auGabaritCourant("badges/FID26-AB12/v1-100x150.png")).toBe(false);
    expect(auGabaritCourant(null)).toBe(false);
  });
});

describe.skipIf(!resolveBrowserPath())("rendu du badge (Puppeteer)", () => {
  afterAll(async () => {
    await closeBrowser();
  }, 30_000);

  it("produit un PDF de 100 × 150 mm et un PNG au même rapport", async () => {
    const html = await sampleHtml(1);

    const pdf = await renderHtmlToPdf(html, {
      taille: { largeurMm: FORMAT_BADGE.largeurMm, hauteurMm: FORMAT_BADGE.hauteurMm },
    });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.byteLength).toBeGreaterThan(1000);
    // Une seule page, à la taille du badge : rien ne déborde sur une seconde.
    const texte = pdf.toString("latin1");
    expect(texte.match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
    const boite = texte.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
    // Chromium arrondit la page au point entier : 1 pt d'écart au plus (0,35 mm).
    expect(Math.abs(Number(boite?.[1]) - enPoints(100))).toBeLessThanOrEqual(1);
    expect(Math.abs(Number(boite?.[2]) - enPoints(150))).toBeLessThanOrEqual(1);

    const png = await renderHtmlToPng(html, { width: 1200 });
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    // Largeur et hauteur encodées dans le chunk IHDR (octets 16-23).
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(1800);
  }, 60_000);
});
