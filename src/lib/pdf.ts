export interface RenderPdfOptions {
  format?: "A4" | "A6" | "CR80";
  landscape?: boolean;
}

/**
 * Rendu HTML → PDF (Puppeteer, brief §3.1). Non implémenté à ce stade : le
 * module badges (PLAN.md 3.6) est le premier consommateur et Puppeteer
 * embarque Chromium (~300 Mo) — installé à ce moment plutôt qu'en amont, sans
 * rien pour l'exercer. Interface posée dès maintenant pour que les modules
 * qui en dépendent (badges, feuilles de présence, actes) programment contre
 * une abstraction stable. Cf. PLAN.md, TODO T11.
 */
export async function renderHtmlToPdf(
  _html: string,
  _options: RenderPdfOptions = {},
): Promise<Buffer> {
  throw new Error("renderHtmlToPdf: not implemented yet (Puppeteer wiring — PLAN.md TODO T11).");
}
