import "dotenv/config";
import {
  closeBrowser,
  renderHtmlToPdf,
  renderHtmlToPdfAndPng,
  resolveBrowserPath,
} from "../src/lib/pdf";
import { generateQrDataUrl } from "../src/lib/qr";
import { renderBadgeHtml } from "../src/modules/badges/template";
import { buildBadgeToken } from "../src/modules/badges/token";

/**
 * Mesure du débit de rendu des badges (brief §5.4 : 500 badges en moins de
 * 5 minutes, soit 600 ms/badge).
 *
 * Volontairement **hors de la suite de tests** : Vitest exécute les fichiers en
 * parallèle, si bien qu'une assertion de temps mesure surtout la contention
 * CPU du moment — le même lot passait à 201 ms/badge isolé et 778 ms/badge au
 * milieu des autres fichiers. Un seuil dans ces conditions n'aurait rien
 * signifié. Ici la mesure est prise seule, donc reproductible.
 *
 *   pnpm bench:badges [nombre]
 */
async function sample(index: number): Promise<string> {
  const publicId = `FID26-BN${String(index).padStart(4, "0")}`;
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

async function main(): Promise<void> {
  if (!resolveBrowserPath()) {
    console.error("Aucun navigateur trouvé — définir PUPPETEER_EXECUTABLE_PATH.");
    process.exit(1);
  }

  const count = Number(process.argv[2] ?? 24);
  const concurrency = process.env.PDF_RENDER_CONCURRENCY ?? "4";
  const pages = await Promise.all(Array.from({ length: count }, (_, i) => sample(i)));

  // Rendu à blanc : ne pas facturer le démarrage du navigateur à la mesure.
  await renderHtmlToPdf(pages[0]!, { format: "CR80" });

  const start = Date.now();
  await Promise.all(
    pages.map((html) => renderHtmlToPdfAndPng(html, { format: "CR80" }, { width: 1200 })),
  );
  const perBadge = (Date.now() - start) / count;

  console.log(
    `${count} badges (PDF + PNG), concurrence ${concurrency} : ` +
      `${perBadge.toFixed(0)} ms/badge → 500 badges ≈ ${((perBadge * 500) / 60_000).toFixed(1)} min ` +
      `(budget : 600 ms/badge, soit 5 min)`,
  );

  await closeBrowser();
  process.exit(perBadge < 600 ? 0 : 1);
}

main();
